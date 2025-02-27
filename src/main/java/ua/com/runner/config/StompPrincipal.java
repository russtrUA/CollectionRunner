package ua.com.runner.config;

import java.security.Principal;

class StompPrincipal implements Principal {
    private final String name;

    StompPrincipal(String name) {
        this.name = name;
    }

    @Override
	public String getName() {
        return name;
    }
}