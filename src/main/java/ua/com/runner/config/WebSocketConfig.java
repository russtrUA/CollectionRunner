package ua.com.runner.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
	
	@Override
	public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
		registration.setMessageSizeLimit(1024 * 1024 * 1024); // Розмір повідомлення в байтах
		registration.setSendBufferSizeLimit(1024 * 1024 * 1024);
		registration.setSendTimeLimit(300000); // Ліміт часу на відправку повідомлення
	}

	@Override
	public void configureMessageBroker(MessageBrokerRegistry config) {
		config.enableSimpleBroker("/topic");
		config.setApplicationDestinationPrefixes("/app");
	}

	@Override
	public void registerStompEndpoints(StompEndpointRegistry registry) {
		registry.addEndpoint("/ws-run-collection").setHandshakeHandler(new CustomHandshakeHandler());
	}

}
