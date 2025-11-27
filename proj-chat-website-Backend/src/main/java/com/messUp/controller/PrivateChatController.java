package com.messUp.controller;

import com.messUp.DTO.PrivateMessageDTO;
import com.messUp.DTO.ReadReceiptDTO;
import com.messUp.entity.PrivateMessage;
import com.messUp.service.PrivateChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.security.Principal;
import java.util.List;

@Controller
public class PrivateChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final PrivateChatService privateChatService;

    public PrivateChatController(SimpMessagingTemplate messagingTemplate,
                                 PrivateChatService privateChatService) {
        this.messagingTemplate = messagingTemplate;
        this.privateChatService = privateChatService;

    }

    @MessageMapping("/sendPrivateMessage")
    public void sendPrivateMessage(PrivateMessageDTO privateMessageDTO) {
        System.out.println(privateMessageDTO.getTempId());
        PrivateMessage savedMessage  = privateChatService.sendMessage(privateMessageDTO);

        privateMessageDTO.setTimestamp(savedMessage.getTimestamp());
        privateMessageDTO.setMessageId(savedMessage.getId());

        messagingTemplate.convertAndSendToUser(privateMessageDTO.getReceiver(), "/private", privateMessageDTO);

        privateChatService.markAsDelivered(savedMessage);
    }

    @MessageMapping("/markAsRead")
    public void markAsRead(ReadReceiptDTO readReceiptDTO) {
        ReadReceiptDTO receipt = privateChatService.markMessageAsRead(readReceiptDTO);

        // Notify sender about read receipt
        messagingTemplate.convertAndSendToUser(receipt.getSender(), "/private/read-receipts", receipt);
    }

    @GetMapping("oldChat/{username}")
    public ResponseEntity<List<PrivateMessageDTO>> getChatHistory(Principal principal,@PathVariable String username) {
        String currentUsername = principal.getName();
        List<PrivateMessageDTO> chatHistory = privateChatService.getChatHistory(currentUsername, username);
        return ResponseEntity.ok(chatHistory);
    }
}
