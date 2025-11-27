package com.messUp.eventHandling;

import com.messUp.entity.PrivateMessage;
import lombok.Data;

@Data
public class MessageSentEvent {
    private final PrivateMessage message;
    private final String tempId;
    public MessageSentEvent(PrivateMessage message, String tempId) {
        this.message = message;
        this.tempId = tempId;
    }
}
