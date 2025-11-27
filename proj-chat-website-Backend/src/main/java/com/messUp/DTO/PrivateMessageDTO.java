package com.messUp.DTO;

import com.messUp.entity.PrivateMessage;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PrivateMessageDTO {

    private Long messageId;
    private String tempId;
    private String message;
    private String sender;
    private String receiver;
    private String mediaUrl;
    private PrivateMessage.MediaType mediaType = PrivateMessage.MediaType.TEXT;
    private PrivateMessage.MessageStatus status = PrivateMessage.MessageStatus.SENT;
    private LocalDateTime timestamp;

}
