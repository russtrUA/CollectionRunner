package ua.com.runner;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.*;

import javax.net.ssl.HttpsURLConnection;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.JsonNode;

@Controller
public class RunnerController {

	private Map<String, MyExecutorService> collExecutors = Collections.synchronizedMap(new HashMap<>());
	private boolean isHttpsSet = MyUtils.setHTTPSConnectionSettings();

	@Autowired
	private SimpMessagingTemplate messagingTemplate;

	@GetMapping("/")
	public String home() {
		return "index";
	}

	@GetMapping("/load")
	public @ResponseBody String loadJson() {
		StringBuilder content = MyUtils.readFile("collections.json");
		if (content.isEmpty()) {
			content.append("{}");
		}
		return content.toString();
	}

	@PostMapping("/save-to-file")
	public @ResponseBody String saveToFile(@RequestBody String clientRequest) {
		if (MyUtils.writeFile("collections.json", clientRequest)) {
			return "Saved successfully";
		} else {
			return "Saving error";
		}

	}

	@PostMapping("/send-request")
	public @ResponseBody String sendRequest(@RequestBody JsonNode clientRequest) {

		HttpURLConnection con = null;
		StringBuilder response = new StringBuilder();
		try {
			String request = clientRequest.get("jsonBody").asText();
			URI uri = new URI(clientRequest.get("url").asText());
			if ("http".equals(uri.getScheme())) {
				con = (HttpURLConnection) uri.toURL().openConnection();
			} else if ("https".equals(uri.getScheme())) {
				if (!isHttpsSet) {
					System.out.println("Warning! HTTPS settings is not set. Check user.config");
				}
				con = (HttpsURLConnection) uri.toURL().openConnection();
			}
			// Налаштування методу та інших параметрів
			con.setRequestMethod(clientRequest.get("method").asText());
			con.setRequestProperty("Content-Type", "application/json");
			// Відправлення даних (якщо потрібно)
			con.setDoOutput(true);
			con.setDoInput(true);
			con.setConnectTimeout(10000);
			con.setReadTimeout(10000);
			con.connect();
			try (DataOutputStream wr = new DataOutputStream(con.getOutputStream());
                 BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(wr, StandardCharsets.UTF_8));) {
				writer.write(request);
			}

			int responseCode = con.getResponseCode();
			System.out.println("RC: " + responseCode);
			// Зчитування відповіді

			try (BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()))) {
				String inputLine;

				while ((inputLine = in.readLine()) != null) {
					response.append(inputLine);
				}
			} catch (IOException e) {
				e.printStackTrace();
				return e.getMessage();
			}
			con.disconnect();
		} catch (Exception e) {
			e.printStackTrace();
			return e.getMessage();
		} finally {
			if (con != null) {
				con.disconnect();
			}
		}
		return response.toString();
	}

	@MessageMapping("/start-executing")
	public void sendArray(Principal principal, String json) {
		String username = principal.getName();
		MyExecutorService executor = new MyExecutorService(messagingTemplate, username);
		collExecutors.put(username, executor);
		executor.execute(json);
		if (collExecutors.get(username) != null) {
			collExecutors.remove(username);
		} 
	}

	@MessageMapping("/stop-executing")
	public void stopExecuting(Principal principal) {
		String username = principal.getName();
		collExecutors.get(username).stop();
		collExecutors.remove(username);
	}

}