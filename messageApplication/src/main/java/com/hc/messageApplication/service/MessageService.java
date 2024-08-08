package com.hc.messageApplication.service;

public class MessageService {
	private String content;
	
	public MessageService() {
		
	}
	
	public MessageService(String content) {
		this.content=content;
	}

	public String getContent() {
		return content;
	}
}
