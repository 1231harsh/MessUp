package com.messUp.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "group_keys",
        uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id"}))
public class GroupKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Group group;

    @ManyToOne(optional = false)
    private User user;

    // AES group key encrypted using USER PUBLIC KEY
    @Column(columnDefinition = "TEXT", nullable = false)
    private String encryptedGroupKey;
}
