package com.messUp.DTO;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GroupMessageDTO {
    private Long messageId;
    private String tempId;

    private Long groupId;
    private String sender;
    private String senderName;
    private String message;

    private String iv;


    @JsonFormat(shape = JsonFormat.Shape.STRING)
    private LocalDateTime timestamp;
}
