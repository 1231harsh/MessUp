package com.messUp.eventHandling;

import com.messUp.DTO.ReadReceiptDTO;
import com.messUp.entity.PrivateMessage;

public class MessageReadEvent {
    private final PrivateMessage message;
    private final ReadReceiptDTO receipt;

    public MessageReadEvent(PrivateMessage message, ReadReceiptDTO receipt) {
        this.message = message;
        this.receipt = receipt;
    }

    public PrivateMessage getMessage() {
        return message;
    }

    public ReadReceiptDTO getReceipt() {
        return receipt;
    }
}
