package com.hc.messageApplication.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.ModelAndView;

import com.hc.messageApplication.model.MessageRS;

import jakarta.servlet.http.HttpSession;

@Controller
public class MessageController {
	@Autowired
	MessageRS mrs;
	
	@RequestMapping("/")
	public String index() {
		System.out.println("inside index method");
		return "index";
	}
	
	@RequestMapping("/home")
	public String app(@RequestParam("name")String name,HttpSession session) {
		if(name==null) {
			return "redirect:/";
		}
		session.setAttribute("userName", name);
		session.setAttribute("color",mrs.getRandomColor());
		return "chat";
	}
	
	@MessageMapping("/sent")
	@SendTo("/topic/sentMeth")
	 public MessageRS sendMess(@Payload MessageRS mess) throws Exception {
	    Thread.sleep(1000); // simulated delay
	    return mess ;
	  }
}
