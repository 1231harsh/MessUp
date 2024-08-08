package com.hc.messageApplication.model;

import java.util.Random;

import org.springframework.stereotype.Component;

@Component
public class MessageRS {
	private String mess_content;
	private String name_string;
	private String color;
	
	
	public MessageRS() {
		// TODO Auto-generated constructor stub
	}
	public MessageRS(String mess_content,String name_string,String color) {
		// TODO Auto-generated constructor stub
		this.mess_content=mess_content;
		this.name_string=name_string;
		this.color=color;
	}
	public String getRandomColor() {
        char[] letters = "0123456789ABCDEF".toCharArray();
        StringBuilder color = new StringBuilder("#");
        Random random = new Random();
        for (int i = 0; i < 6; i++) {
            color.append(letters[random.nextInt(16)]);
        }
        return color.toString();
    }
	public String getColor() {
		return color;
	}
	public void setColor(String color) {
		this.color = color;
	}
	public String getMess_content() {
		return mess_content;
	}
	public void setMess_content(String mess_content) {
		this.mess_content = mess_content;
	}
	public String getName_string() {
		return name_string;
	}
	public void setName_String(String name_string) {
		this.name_string = name_string;
	}
}
