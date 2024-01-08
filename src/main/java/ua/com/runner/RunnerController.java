package ua.com.runner;

import java.security.Principal;
import java.util.concurrent.atomic.*;
import java.util.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
public class RunnerController {
	private static AtomicBoolean isBusy = new AtomicBoolean(false);
	
	private Map<String, MyExecutorService> collExecutors = Collections.synchronizedMap(new HashMap<>());
	
	@Autowired
	private SimpMessagingTemplate messagingTemplate;

	@GetMapping("/")
	public String home() {
		return "index";
	}

	@GetMapping("/load")
	public @ResponseBody String loadJson() {
		return MyUtils.readFile("collections.json").toString();
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
	public @ResponseBody String sendRequest(@RequestBody String clientRequest) {

		// Тут ви можете виконати логіку взаємодії з API
		// Наприклад, використовуйте RestTemplate для надсилання запиту

		// Припустимо, що ви отримали відповідь в форматі JSON
//        String apiResponse = "{ \"status\": \"success\", \"message\": \"Request sent successfully\" }";

		return clientRequest;
	}

	@MessageMapping("/start-executing")
	public void sendArray(Principal principal, String json) {
		String username = principal.getName();
//	     if (!isBusy.get()) {
		isBusy.set(true);
		MyExecutorService executor = new MyExecutorService(messagingTemplate, username);
		collExecutors.put(username, executor);
		executor.execute(json);
//	    	 ArrayNode arrayNode = (ArrayNode) jsonNode;

//		     for (int i = 0; i < json.length; i++) {
//		    	 System.out.println(json[i]);  
//		    	 messagingTemplate.convertAndSendToUser(username,"/topic/result", "{\"index\":" + i + "}");
//		         try {
//					Thread.sleep(1000);
//				} catch (InterruptedException e) {
//					e.printStackTrace();
//				}
//		     }
//		     messagingTemplate.convertAndSendToUser(username,"/topic/result", "{\"name\" :\"stop\"}");
		isBusy.set(false);
//		} 
//	     else {
//	    	 messagingTemplate.convertAndSendToUser(username,"/topic/result", "{\"name\" :\"busy\"}");
//		}

	}
	
	@MessageMapping("/stop-executing")
	public void stopExecuting(Principal principal) {
		String username = principal.getName();
		collExecutors.get(username).stop();
		collExecutors.remove(username);
	}
	
}