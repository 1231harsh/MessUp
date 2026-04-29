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

    /* ================= MESSAGE SENT ================= */

    @EventListener
    public void handleMessageSent(MessageSentEvent event) {
        PrivateMessage msg = event.getMessage();
        String tempId = event.getTempId();

        PrivateMessageDTO dto = mapToDTO(msg);
        dto.setTempId(tempId);

        // 1️⃣ Echo back to sender (replace temp message)
        messagingTemplate.convertAndSendToUser(
                msg.getSender().getUsername(),
                "/private/sent",
                dto
        );

        // 2️⃣ Deliver to receiver
        messagingTemplate.convertAndSendToUser(
                msg.getReceiver().getUsername(),
                "/private",
                dto
        );
    }

    /* ================= DELIVERED ================= */

    @EventListener
    public void handleMessageDelivered(MessageDeliveredEvent event) {
        PrivateMessage msg = event.getMessage();

        messagingTemplate.convertAndSendToUser(
                msg.getSender().getUsername(),
                "/private/delivered",
                mapToDTO(msg)
        );
    }

    /* ================= READ ================= */

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

    /* ================= DTO MAPPING ================= */

    private PrivateMessageDTO mapToDTO(PrivateMessage msg) {
        PrivateMessageDTO dto = new PrivateMessageDTO();

        dto.setMessageId(msg.getId());
        dto.setSender(msg.getSender().getUsername());
        dto.setReceiver(msg.getReceiver().getUsername());
        dto.setMessage(msg.getMessage());

        dto.setMediaId(msg.getMediaId());
        dto.setMediaType(msg.getMediaType());

        // 🔐 CRITICAL: include encryption metadata
        dto.setEncryptedKeyForRecipient(msg.getEncryptedKeyForRecipient());
        dto.setEncryptedKeyForSender(msg.getEncryptedKeyForSender());
        dto.setIv(msg.getIv());
        dto.setContentType(msg.getContentType());

        dto.setStatus(msg.getStatus());
        dto.setTimestamp(msg.getTimestamp());

        return dto;
    }
}
