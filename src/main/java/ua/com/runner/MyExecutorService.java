package ua.com.runner;

import java.io.*;
import java.net.*;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class MyExecutorService {
	private volatile boolean isInterrupted = false;

	private SimpMessagingTemplate messagingTemplate;

	private ExecutorService executorService;
	private List<Integer> responseCodes = Collections.synchronizedList(new ArrayList<>());
	private String logFilePath;
	private AtomicInteger passed = new AtomicInteger(0);
	private AtomicInteger failed = new AtomicInteger(0);
	private int delay = 0;
	private String userName;
	private Instant start;
	private Instant end;

	public MyExecutorService(SimpMessagingTemplate messagingTemplate, String userName) {
		this.messagingTemplate = messagingTemplate;
		this.userName = userName;
	}

	private StringBuilder gatherInfo() {
		Map<Integer, Integer> occurrences = new HashMap<>();

		// Підрахунок кількості входжень кожного значення в колекції
		for (Integer number : responseCodes) {
			occurrences.put(number, occurrences.getOrDefault(number, 0) + 1);
		}
		StringBuilder message = new StringBuilder();
		// Виведення результату
		for (Map.Entry<Integer, Integer> entry : occurrences.entrySet()) {
			message.append("Response code: " + entry.getKey() + ", Кількість: " + entry.getValue() + "\\n");
//			System.out.println(message);
		}
		message.append("Total: Passed - " + passed.get() + ", Failed - " + failed.get() + "\\n");
//		System.out.println(message);
		// Запам'ятовуємо час завершення
		end = Instant.now();

		// Розрахунок тривалості виконання
		Duration duration = Duration.between(start, end);

		// Виведення результатів у форматі хвилини та секунди
		long minutes = duration.toMinutes();
		long seconds = duration.minusMinutes(minutes).getSeconds();
		message.append("Start Time: " + start + "\\n" + "End Time: " + end + "\\n" + "Duration: " + minutes
				+ " minutes and " + seconds + " seconds" + "\\n");
		return message;

	}

	public void execute(String config) {
		// Запам'ятовуємо час старту
		start = Instant.now();
		ObjectMapper objectMapper = new ObjectMapper();

//		StringBuilder[][] arrayCollection = null;
		JsonNode requests = null, iterations = null;
		int numThreads = 1;
		try {
			JsonNode jsonConfig = objectMapper.readTree(config);
			numThreads = jsonConfig.get("numThreads").asInt();
			delay = jsonConfig.get("delay").asInt();
			requests = jsonConfig.get("requests");
			iterations = jsonConfig.get("iterations");
		} catch (JsonProcessingException e) {
			e.printStackTrace();
		}
		logFilePath = "log_" + DateTimeFormatter.ofPattern("yyyyMMdd").format(LocalDate.now()) + ".txt";

//		MyUtils.setHTTPSConnectionSettings();
//		
		executorService = Executors.newFixedThreadPool(numThreads);
//		System.out.println(iterations.size());
		for (int i = 0; i < numThreads && i < (iterations.size() != 0 ? iterations.size() : numThreads); i++) {
//			executorService.execute(new MyRunnable(config));
			executorService.execute(new ArrayRequestProcessor(iterations, requests, i, numThreads));
		}
		executorService.shutdown();
		while (!executorService.isTerminated()) {
			try {
				Thread.sleep(1000);
				if (!isInterrupted) {
					messagingTemplate.convertAndSendToUser(userName, "/topic/result",
							"{\"body\":{\"status\":\"running\",\"passed\":" + passed.get() + ", \"failed\":"
									+ failed.get() + "}}");
				}
				System.out.println("Passsed: " + passed.get() + "; Failed: " + failed.get());
			} catch (InterruptedException e) {
				e.printStackTrace();
			}
		}
		StringBuilder message = gatherInfo();
//		System.out.println(message);
		if (!isInterrupted) {
			System.out.println("{\"body\":{\"status\":\"finished\", \"message\":\"" + message + "\"}}");
			messagingTemplate.convertAndSendToUser(userName, "/topic/result",
					"{\"body\":{\"status\":\"finished\",\"passed\":" + passed.get() + ", \"failed\":" + failed.get()
							+ ", \"message\":\"" + message + "\"}}");
		}

	}

	public void stop() {
		isInterrupted = true;
		messagingTemplate.convertAndSendToUser(userName, "/topic/result", "{\"body\":{\"status\":\"stopping\"}}");
		while (!executorService.isTerminated()) {
			try {
				Thread.sleep(100);
			} catch (InterruptedException e) {
				e.printStackTrace();
				messagingTemplate.convertAndSendToUser(userName, "/topic/result",
						"{\"body\":{\"status\":\"interrupted\"}}");
			}
		}
		StringBuilder message = gatherInfo();
//		System.out.println(message);
		messagingTemplate.convertAndSendToUser(userName, "/topic/result",
				"{\"body\":{\"status\":\"stopped\", \"passed\":" + passed.get() + ", \"failed\":" + failed.get() + ",\"message\":\"" + message + "\"}}");

	}

	class ArrayRequestProcessor implements Runnable {
		private final JsonNode arrayOfVars;
		private final int threadIndex;
		private final int numThreads;
		private final JsonNode arrayOfRequests;

		public ArrayRequestProcessor(JsonNode arrayOfVars, JsonNode arrayOfRequests, int threadIndex, int numThreads) {
			this.arrayOfVars = arrayOfVars;
			this.threadIndex = threadIndex;
			this.numThreads = numThreads;
			this.arrayOfRequests = arrayOfRequests;
		}

		@Override
		public void run() {
			HttpURLConnection con = null;
			try {
				int i = threadIndex;
				do {
					if (isInterrupted) {
						Thread.currentThread().interrupt();
						System.out.println(Thread.currentThread().getName() + ": stopped");
						break;
					}
					if (!arrayOfVars.isEmpty() && i == 0) {
						i += numThreads;
						continue;
					}
					for (JsonNode runRequest : arrayOfRequests) {
						String request = arrayOfVars.isEmpty() ? runRequest.get("body").toString()
								: MyUtils.fillBody(new StringBuilder(runRequest.get("body").toString()),
										arrayOfVars.get(0), arrayOfVars.get(i));
//						System.out.println((!arrayOfVars.isEmpty() ? arrayOfVars.get(i) : "[]") + " "
//								+ runRequest.get("method").asText() + " " + runRequest.get("url").asText()
//								+ " Request: " + request);
						// Налаштування HttpsURLConnection
						URI uri = new URI(runRequest.get("url").asText());
						if ("http".equals(uri.getScheme())) {
							con = (HttpURLConnection) uri.toURL().openConnection();
						} else if ("https".equals(uri.getScheme())) {
							con = (HttpsURLConnection) uri.toURL().openConnection();
						}
						// Налаштування методу та інших параметрів
						con.setRequestMethod(runRequest.get("method").asText());
						con.setRequestProperty("Content-Type", "application/json");
						// Відправлення даних (якщо потрібно)
						con.setDoOutput(true);
						con.setDoInput(true);
						con.setConnectTimeout(10000);
						con.setReadTimeout(10000);
						con.connect();
						// System.out.println(request);
						Instant startRequest = Instant.now();

						
						try (DataOutputStream wr = new DataOutputStream(con.getOutputStream())) {
							wr.writeBytes(request);
							wr.flush();
						}

						int responseCode = con.getResponseCode();
						responseCodes.add(responseCode);

						// Зчитування відповіді
						try (BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()))) {
							String inputLine;
							StringBuilder response = new StringBuilder();

							while ((inputLine = in.readLine()) != null) {
								response.append(inputLine);
							}
							Instant endRequest = Instant.now();
							// Розрахунок тривалості виконання
							Duration duration = Duration.between(startRequest, endRequest);
							long millis = duration.toMillis();
							// Обробка JSON-відповіді
							MyUtils.log(logFilePath,
									(!arrayOfVars.isEmpty() ? arrayOfVars.get(i) : "[]") + " "
											+ runRequest.get("method").asText() + " " + runRequest.get("url").asText()
											+ " Request: " + request + " - " + responseCode + "\n" + "Response: "
											+ response.toString() + " - " + millis + "ms.");
							// Перетворюємо JSON-рядок у об'єкт JsonNode
							ObjectMapper objectMapper = new ObjectMapper();
							JsonNode jsonNode = objectMapper.readTree(response.toString());

							// Отримуємо значення, яке міститься у $.body.response.code
							String responseBodyCode = jsonNode.path("body").path("response").path("code").asText();

							// Проводимо перевірку значення
							if ("SLR-0001".equals(responseBodyCode)) {
								passed.incrementAndGet();
							} else {
								failed.incrementAndGet();
							}

						}
						con.disconnect();
						// Затримка між викликами запитів
						try {
							Thread.sleep(delay);
						} catch (InterruptedException e) {
							e.printStackTrace();
						}
					}
					i += numThreads;
				} while (i < arrayOfVars.size());

			} catch (Exception e) {
				failed.incrementAndGet();
				e.printStackTrace();
			} finally {
				if (con != null) {
					con.disconnect();
				}
			}
		}
	}

//	class MyRunnable implements Runnable {
//		private final String vars;
//
//		public MyRunnable(String vars) {
//			this.vars = vars;
//		}
//
//		@Override
//		public void run() {
//			try {
////				for (char string : vars.toCharArray()) {
//				for (int i = 0; i < 3; i++) {
//					if (isInterrupted) {
//						Thread.currentThread().interrupt();
//						System.out.println(Thread.currentThread().getName() + ": stopped");
//						break;
//					}
////					System.out.println(Thread.currentThread().getName() + ": " + vars);
//					Thread.sleep(1000);
////					System.out.println(Thread.currentThread().getName() + ": " + string + "afterSleeping");
//				}
//			} catch (InterruptedException e) {
//				System.out.println(Thread.currentThread().getName() + " is interrupted.");
//				Thread.currentThread().interrupt();
//
//			}
//		}
//	}
}
