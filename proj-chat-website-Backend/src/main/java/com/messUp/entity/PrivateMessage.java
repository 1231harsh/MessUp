package com.messUp.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "private_messages")
public class PrivateMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /* ================= PARTICIPANTS ================= */

    @ManyToOne(optional = false)
    private User sender;

    @ManyToOne(optional = false)
    private User receiver;

    /* ================= TEXT MESSAGE ================= */

    // Encrypted text payload (JSON string) for TEXT messages
    @Column(columnDefinition = "TEXT")
    private String message;

    /* ================= MEDIA MESSAGE ================= */

    // Reference to Media table (encrypted blob)
    @Column(columnDefinition = "TEXT")
    private String mediaId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MediaType mediaType = MediaType.TEXT;

    public enum MediaType {
        TEXT,
        IMAGE,
        VIDEO,
        AUDIO,
        NONE
    }

    /* ================= ENCRYPTION METADATA ================= */

    // AES key encrypted with receiver's public key (Base64)
    @Column(columnDefinition = "TEXT")
    private String encryptedKeyForRecipient;

    // AES key encrypted with sender's public key (Base64)
    @Column(columnDefinition = "TEXT")
    private String encryptedKeyForSender;

    // AES-GCM IV (Base64)
    @Column(columnDefinition = "TEXT")
    private String iv;

    // Original content type (image/jpeg, image/png, etc.)
    private String contentType;

    /* ================= MESSAGE STATUS ================= */

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MessageStatus status = MessageStatus.SENT;

    public enum MessageStatus {
        SENT,
        DELIVERED,
        READ
    }

    /* ================= TIMESTAMP ================= */

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();
}
