package com.messUp.controller;

import com.messUp.service.PrivateChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/chats")
public class ChatController {

    private final PrivateChatService privateChatService;

    public ChatController(PrivateChatService privateChatService) {
        this.privateChatService = privateChatService;
    }

    @GetMapping("/recent")
    public ResponseEntity<?> getRecentChats(Principal principal) {
        if (principal == null || principal.getName() == null) {
            return ResponseEntity.badRequest().body("User not authenticated");
        }

        String username = principal.getName();
        try {
            return ResponseEntity.ok(privateChatService.getRecentChats(username));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error retrieving recent chats: " + e.getMessage());
        }
    }
}
