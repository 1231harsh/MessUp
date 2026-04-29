package com.messUp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Media {

    @Id
    private String id;

    @Column(nullable = false)
    private String senderId;

    @Column(nullable = false)
    private String receiverId;

    @Lob
    @Column(nullable = false)
    private byte[] encryptedData;

    @Column(nullable = false)
    private String contentType;

    private long size;

    private Instant uploadTimestamp;

}
