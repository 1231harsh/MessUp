package com.messUp.DTO;

import com.messUp.entity.PrivateMessage;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PrivateMessageDTO {

    /* ================= IDENTIFIERS ================= */

    private Long messageId;   // DB ID
    private String tempId;    // Client-side temp ID (for reconciliation)

    /* ================= PARTICIPANTS ================= */

    private String sender;
    private String receiver;

    /* ================= TEXT MESSAGE ================= */

    // Encrypted text payload (JSON string) for TEXT messages
    private String message;

    /* ================= MEDIA MESSAGE ================= */

    // Reference to encrypted media stored separately
    private String mediaId;

    private PrivateMessage.MediaType mediaType = PrivateMessage.MediaType.TEXT;

    // Encryption metadata REQUIRED for decrypting media
    private String encryptedKeyForRecipient;
    private String encryptedKeyForSender;
    private String iv;

    // MIME type of original file (image/jpeg, image/png, etc.)
    private String contentType;

    /* ================= MESSAGE STATUS ================= */

    private PrivateMessage.MessageStatus status = PrivateMessage.MessageStatus.SENT;

    /* ================= TIMESTAMP ================= */

    private LocalDateTime timestamp;
}
