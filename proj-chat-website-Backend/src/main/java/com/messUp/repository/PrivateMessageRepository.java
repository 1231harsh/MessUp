package com.messUp.repository;

import com.messUp.entity.PrivateMessage;
import com.messUp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PrivateMessageRepository extends JpaRepository<PrivateMessage, Long> {

    @Query("SELECT m FROM PrivateMessage m WHERE " +
            "(m.sender.username = :user1 AND m.receiver.username = :user2) OR " +
            "(m.sender.username = :user2 AND m.receiver.username = :user1) " +
            "ORDER BY m.timestamp ASC")
    List<PrivateMessage> findConversationBetween(@Param("user1") String user1, @Param("user2") String user2);

        @Query(value = """
        SELECT pm.* FROM private_messages pm
        INNER JOIN (
            SELECT 
                CASE 
                    WHEN sender_id = :userId THEN receiver_id 
                    ELSE sender_id 
                END AS friend_id,
                MAX(timestamp) AS last_timestamp
            FROM private_messages
            WHERE sender_id = :userId OR receiver_id = :userId
            GROUP BY friend_id
        ) latest 
        ON ( (pm.sender_id = :userId AND pm.receiver_id = latest.friend_id)
            OR (pm.sender_id = latest.friend_id AND pm.receiver_id = :userId) )
        AND pm.timestamp = latest.last_timestamp
        ORDER BY pm.timestamp DESC
    """, nativeQuery = true)
        List<PrivateMessage> findLatestMessagePerFriend(@Param("userId") Long userId);

    Optional<PrivateMessage> findTopBySenderAndReceiverOrderByTimestampDesc(User currentUser, User friend);
}
