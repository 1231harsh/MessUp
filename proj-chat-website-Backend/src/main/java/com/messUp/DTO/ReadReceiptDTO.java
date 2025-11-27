package com.messUp.DTO;

import com.messUp.entity.PrivateMessage;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ReadReceiptDTO {
    private Long messageId;
    private String sender;
    private String receiver;
    private MessageStatus status;
    private LocalDateTime timestamp;

    public enum MessageStatus {
        SENT, DELIVERED, READ
    }
}
