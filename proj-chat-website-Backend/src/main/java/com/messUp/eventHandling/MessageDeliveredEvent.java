package com.messUp.eventHandling;

import com.messUp.entity.PrivateMessage;

public class MessageDeliveredEvent {
    private final PrivateMessage message;

    public MessageDeliveredEvent(PrivateMessage message) {
        this.message = message;
    }

    public PrivateMessage getMessage() {
        return message;
    }
}
