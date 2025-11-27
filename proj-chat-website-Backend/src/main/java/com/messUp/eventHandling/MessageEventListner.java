package com.messUp.eventHandling;

import com.messUp.DTO.PrivateMessageDTO;
import com.messUp.DTO.ReadReceiptDTO;
import com.messUp.entity.PrivateMessage;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class MessageEventListner {

    private final SimpMessagingTemplate messagingTemplate;

    public MessageEventListner(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }


    @EventListener
    public void handleMessageSent(MessageSentEvent event){
        PrivateMessage msg = event.getMessage();
        String tempId = event.getTempId();
        PrivateMessageDTO dto = mapToDTO(msg);
        dto.setTempId(tempId);
        System.out.println(dto.getTempId()+" "+tempId);
        messagingTemplate.convertAndSendToUser(
                msg.getSender().getUsername(),
                "/private/sent",
                dto
        );

    }

    @EventListener
    public void handleMessageDelivered(MessageDeliveredEvent event) {
        PrivateMessage msg = event.getMessage();
        System.out.println("Handling delivery event for message ID: " + msg.getId());
        messagingTemplate.convertAndSendToUser(
                msg.getSender().getUsername(),
                "/private/delivered",
                mapToDTO(msg)
        );
    }

    @EventListener
    public void handleMessageRead(MessageReadEvent event) {
        PrivateMessage msg = event.getMessage();
        ReadReceiptDTO receipt = event.getReceipt();

        messagingTemplate.convertAndSendToUser(
                msg.getSender().getUsername(),
                "/private/read",
                receipt
        );
    }

    private PrivateMessageDTO mapToDTO(PrivateMessage msg) {
        PrivateMessageDTO dto = new PrivateMessageDTO();
        dto.setMessageId(msg.getId());
        dto.setSender(msg.getSender().getUsername());
        dto.setReceiver(msg.getReceiver().getUsername());
        dto.setMessage(msg.getMessage());
        dto.setMediaUrl(msg.getMediaUrl());
        dto.setMediaType(msg.getMediaType());
        dto.setTimestamp(msg.getTimestamp());
        return dto;
    }
}
