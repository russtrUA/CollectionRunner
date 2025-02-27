package ua.com.runner.util;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.*;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.KeyManager;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;

public class MyUtils {
	public static StringBuilder readFile(String pathToFile) {
		StringBuilder content = new StringBuilder();
		try (BufferedReader fileReader = new BufferedReader(new FileReader(pathToFile))) {
			String line;
			while ((line = fileReader.readLine()) != null) {
				content.append(line);
			}
		} catch (IOException e) {
			 System.out.println("Файл не існує. Спробую створити новий.");
	            
	            // Спроба створити новий файл
	            try {
	                File file = new File(pathToFile);
	                if (file.createNewFile()) {
	                    System.out.println("Новий файл створений.");
	                } else {
	                    System.out.println("Не вдалося створити файл.");
	                }
	            } catch (IOException ex) {
	                ex.printStackTrace();
	            }
		}
		return content;
	}

	public static boolean writeFile(String pathToFile, String content) {
		try (BufferedWriter writer = new BufferedWriter(new FileWriter(pathToFile))) {
			writer.write(content);
			return true;
		} catch (IOException e) {
			e.printStackTrace();
			System.err.println("Помилка запису у файл: " + e.getMessage());
			return false;
		}
	}

	public static void log(String fileName, String message) {
		Path filePath = Paths.get(fileName);
		Set<OpenOption> options = Set.of(StandardOpenOption.CREATE, StandardOpenOption.APPEND);
		// Отримуємо поточну дату та час для логу
		LocalDateTime now = LocalDateTime.now();
		DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");
		String formattedDateTime = now.format(formatter);
		try (FileChannel fileChannel = FileChannel.open(filePath, options)) {
			// Записати елемент в файл
			String line = formattedDateTime + ": " + Thread.currentThread().getName() + ": " + message + "\n";
			ByteBuffer buffer = ByteBuffer.wrap(line.getBytes());
			// Забезпечте взаємодію тільки з відповідним потоком
			fileChannel.write(buffer);
		} catch (IOException e) {
			e.printStackTrace(); // Обробка помилок запису у файл
		}
	}

	private static String generateRandomMessageId() {
		Random random = new Random();
		return "" + Math.abs(random.nextLong() % 100000000000000000L);
	}

	private static String getCurrentDateTime() {
		SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS");
		return dateFormat.format(new Date());
	}

	public static String fillBody(StringBuilder body, JsonNode vars, JsonNode values)
			throws JsonMappingException, JsonProcessingException {
		body = new StringBuilder(body);
		// fill placeholders {{VAR}}
		int index = body.indexOf("{{");
		while (index != -1) {
			String var = body.substring(index + 2, body.indexOf("}}", index + 2)).trim();
			for (int i = 0; i < vars.size(); i++) {
				if (var.equalsIgnoreCase(vars.get(i).asText())) {
					if (body.charAt(index - 1) == '"' && body.charAt(body.indexOf("}}", index + 2) + 2) == '"') {
						body.replace(index, body.indexOf("}}", index + 2) + 2, values.get(i).asText());
					} else {
						body.replace(index, body.indexOf("}}", index + 2) + 2, "\"" + values.get(i).asText() + "\"");
					}

					break;
				}
			}
			// Знаходимо наступне входження
			index = body.indexOf("{{", index + 2);
		}
		// change messageId and messageDate
		String strBody = body.toString();
		ObjectMapper objMapper = new ObjectMapper();
		JsonNode rootNode = objMapper.readTree(strBody);

		// Зміна значення для поля messageId, якщо воно існує
		JsonNode headerNode = rootNode.path("header");
		JsonNode messageIdNode = headerNode.path("messageId");
		if (!messageIdNode.isMissingNode()) {
			String randomMessageId = generateRandomMessageId();
			((com.fasterxml.jackson.databind.node.ObjectNode) headerNode).put("messageId", randomMessageId);
		}

		// Зміна значення для поля messageDate, якщо воно існує
		JsonNode messageDateNode = headerNode.path("messageDate");
		if (!messageDateNode.isMissingNode()) {
			String currentDateTime = getCurrentDateTime();
			((com.fasterxml.jackson.databind.node.ObjectNode) headerNode).put("messageDate", currentDateTime);
		}
		return objMapper.writeValueAsString(rootNode);
	}

	public static boolean setHTTPSConnectionSettings() {
		String pfxFilePath, pfxPasswordFilePath;
		// Вказати шлях до файлу налаштувань користувача
		File userConfigFile = new File("user.config");
		if (!userConfigFile.exists()) {
			System.out.println("File user.config doesn't exists");
			return false;
		}
		Properties properties = new Properties();
		try (FileInputStream input = new FileInputStream(userConfigFile)) {
			properties.load(input);
			pfxFilePath = properties.getProperty("pfx_file_path");
			pfxPasswordFilePath = properties.getProperty("pfx_password_path");
		} catch (IOException ex) {
			System.out.println("Помилка при зчитуванні файлу налаштувань: ");
			return false;
		}
		String pfxPassword = null;
		try (BufferedReader fileReader = new BufferedReader(new FileReader(pfxPasswordFilePath))) {
			pfxPassword = fileReader.readLine();
		} catch (FileNotFoundException e1) {
			System.out.println("Файл з паролем не знайдено");
			return false;
		} catch (IOException e1) {
			e1.printStackTrace();
			return false;
		}
		// Завантаження PFX-файлу та встановлення його як довіреного складу ключів
		try {
			KeyStore keyStore = KeyStore.getInstance("PKCS12");
			keyStore.load(new FileInputStream(pfxFilePath), pfxPassword.toCharArray());

			KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
			kmf.init(keyStore, pfxPassword.toCharArray());
			KeyManager[] kms = kmf.getKeyManagers();

			// Отримати системний кейстор "Windows-ROOT"
	        KeyStore trustStore = KeyStore.getInstance("Windows-ROOT");
	        trustStore.load(null, null);

	        // Ініціалізувати TrustManagerFactory з системним кейстором
	        TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
	        tmf.init(trustStore);

	        // Отримати TrustManagers
	        TrustManager[] tms = tmf.getTrustManagers();

			// Створення SSLContext з TrustManagerFactory
			SSLContext sslContext = SSLContext.getInstance("TLS");
			sslContext.init(kms, tms, new SecureRandom());
			SSLContext.setDefault(sslContext);

			// Встановлення фабрики сокетів для HttpsURLConnection
			HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
		} catch (Exception e) {
			e.printStackTrace();
			return false;
		}
		return true;
	}
}
