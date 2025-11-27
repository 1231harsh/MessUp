package com.messUp.DTO;

import com.messUp.entity.PrivateMessage;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RecentChatDTO {

    private Long messageIid;
    private String username;
    private String profilePicture;
    private String lastMessage;
    private LocalDateTime timestamp;
    private boolean sentByMe;

    public RecentChatDTO(String username, String profilePicture, PrivateMessage lstMessage,String currentUsername) {
        this.username = username;
        this.profilePicture = profilePicture;

        if(lstMessage != null) {
            this.lastMessage = lstMessage.getMessage();
            this.timestamp = lstMessage.getTimestamp();
            this.sentByMe = lstMessage.getSender().getUsername().equals(currentUsername);
        }
    }
}
