package com.messUp.service;

import com.messUp.DTO.PrivateMessageDTO;
import com.messUp.DTO.ReadReceiptDTO;
import com.messUp.DTO.RecentChatDTO;
import com.messUp.entity.PrivateMessage;
import com.messUp.entity.User;
import com.messUp.eventHandling.MessageDeliveredEvent;
import com.messUp.eventHandling.MessageReadEvent;
import com.messUp.eventHandling.MessageSentEvent;
import com.messUp.repository.PrivateMessageRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class PrivateChatService {

    private final UserService userService;
    private final PrivateMessageRepository privateMessageRepository;
    private final ApplicationEventPublisher publisher;

    public PrivateChatService(UserService userService, PrivateMessageRepository privateMessageRepository, ApplicationEventPublisher publisher) {
        this.userService = userService;
        this.privateMessageRepository = privateMessageRepository;
        this.publisher = publisher;
    }

    public List<RecentChatDTO> getRecentChats(String username) {
        User currentUser = userService.getUserByUsername(username);

        List<PrivateMessage> messages = privateMessageRepository.findLatestMessagePerFriend(currentUser.getId());
        List<RecentChatDTO> recentChats = new ArrayList<>();

        for (PrivateMessage lastMsg : messages) {
            User friend = lastMsg.getSender().equals(currentUser) ? lastMsg.getReceiver() : lastMsg.getSender();
            recentChats.add(new RecentChatDTO(
                    friend.getUsername(),
                    friend.getProfilePicture(),
                    lastMsg,
                    currentUser.getUsername()
            ));
        }

        return recentChats;
    }

    public PrivateMessage sendMessage(PrivateMessageDTO privateMessageDTO) {
        User sender = userService.getUserByUsername(privateMessageDTO.getSender());
        User receiver = userService.getUserByUsername(privateMessageDTO.getReceiver());

        PrivateMessage message = new PrivateMessage();
        message.setSender(sender);
        message.setReceiver(receiver);
        message.setMessage(privateMessageDTO.getMessage());
        message.setMediaUrl(privateMessageDTO.getMediaUrl());
        message.setMediaType(privateMessageDTO.getMediaType());
        message.setStatus(PrivateMessage.MessageStatus.SENT);
        message.setTimestamp(java.time.LocalDateTime.now());

        privateMessageRepository.save(message);
        publisher.publishEvent(new MessageSentEvent(message, privateMessageDTO.getTempId()));

        return message;
    }

    public void markAsDelivered(PrivateMessage message) {
        message.setStatus(PrivateMessage.MessageStatus.DELIVERED);
        privateMessageRepository.save(message);

        publisher.publishEvent(new MessageDeliveredEvent(message));
    }

    public ReadReceiptDTO markMessageAsRead(ReadReceiptDTO dto) {
        return privateMessageRepository.findById(dto.getMessageId())
                .map(message -> {
                    message.setStatus(PrivateMessage.MessageStatus.READ);
                    privateMessageRepository.save(message);

                    ReadReceiptDTO receipt = new ReadReceiptDTO(
                            message.getId(),
                            message.getSender().getUsername(),
                            message.getReceiver().getUsername(),
                            ReadReceiptDTO.MessageStatus.READ,
                            java.time.LocalDateTime.now()
                    );

                    // Fire event
                    publisher.publishEvent(new MessageReadEvent(message, receipt));
                    return receipt;
                })
                .orElseThrow(() -> new RuntimeException("Message not found"));
    }

    public List<PrivateMessageDTO> getChatHistory(String currentUsername, String targetUsername) {
        userService.getUserByUsername(targetUsername);
        List<PrivateMessage> messages = privateMessageRepository.findConversationBetween(currentUsername, targetUsername);

        return messages.stream().map(this::mapToDto).toList();
    }

    private PrivateMessageDTO mapToDto(PrivateMessage message) {
        PrivateMessageDTO dto = new PrivateMessageDTO();
        dto.setMessage(message.getMessage());
        dto.setSender(message.getSender().getUsername());
        dto.setReceiver(message.getReceiver().getUsername());
        dto.setMediaUrl(message.getMediaUrl());
        dto.setMediaType(message.getMediaType());
        dto.setTimestamp(message.getTimestamp());
        return dto;
    }
}
