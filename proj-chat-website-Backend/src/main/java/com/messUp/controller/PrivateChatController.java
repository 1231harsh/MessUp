package com.messUp.controller;

import com.messUp.DTO.PrivateMessageDTO;
import com.messUp.DTO.ReadReceiptDTO;
import com.messUp.service.PrivateChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.security.Principal;
import java.util.List;

@Controller
public class PrivateChatController {

    private final PrivateChatService privateChatService;

    public PrivateChatController(PrivateChatService privateChatService) {
        this.privateChatService = privateChatService;
    }

    /* ================= SEND MESSAGE ================= */

    @MessageMapping("/sendPrivateMessage")
    public void sendPrivateMessage(PrivateMessageDTO privateMessageDTO) {
        // 🔑 Only save message
        // 🔑 Events will handle delivery
        privateChatService.sendMessage(privateMessageDTO);
    }

    /* ================= READ RECEIPT ================= */

    @MessageMapping("/markAsRead")
    public void markAsRead(ReadReceiptDTO readReceiptDTO) {
        privateChatService.markMessageAsRead(readReceiptDTO);
    }

    /* ================= CHAT HISTORY ================= */

    @GetMapping("oldChat/{username}")
    public ResponseEntity<List<PrivateMessageDTO>> getChatHistory(
            Principal principal,
            @PathVariable String username
    ) {
        String currentUsername = principal.getName();
        return ResponseEntity.ok(
                privateChatService.getChatHistory(currentUsername, username)
        );
    }
}
