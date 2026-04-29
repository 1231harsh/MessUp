package com.messUp.service;

import com.messUp.entity.Group;
import com.messUp.entity.User;
import com.messUp.repository.GroupKeyRepository;
import com.messUp.repository.GroupMemberRepository;
import com.messUp.repository.GroupMessageRepository;
import com.messUp.repository.GroupRepository;
import com.messUp.repository.UserPublicKeyRepository;
import com.messUp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GroupChatServiceTest {

    @Mock
    private GroupRepository groupRepository;
    @Mock
    private GroupMessageRepository groupMessageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private GroupMemberRepository groupMemberRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private GroupKeyRepository groupKeyRepository;
    @Mock
    private UserPublicKeyRepository publicKeyRepository;

    private GroupChatService groupChatService;

    @BeforeEach
    void setUp() {
        groupChatService = new GroupChatService(
                groupRepository,
                groupMessageRepository,
                userRepository,
                groupMemberRepository,
                messagingTemplate,
                groupKeyRepository,
                publicKeyRepository
        );
    }

    @Test
    void addMemberToGroupRejectsNonAdminCallers() {
        Group group = new Group();
        group.setId(10L);

        User creator = new User();
        creator.setUsername("creator");
        group.setCreatedBy(creator);

        User actingUser = new User();
        actingUser.setUsername("member");

        when(groupRepository.findById(10L)).thenReturn(Optional.of(group));
        when(userRepository.findByUsername("member")).thenReturn(Optional.of(actingUser));
        when(groupMemberRepository.findByGroupAndUser(group, actingUser)).thenReturn(Optional.empty());

        assertThrows(
                AccessDeniedException.class,
                () -> groupChatService.addMemberToGroup(10L, "newUser", "member")
        );

        verify(userRepository, never()).findByUsername("newUser");
    }

    @Test
    void getMembersOfGroupRejectsNonMembers() {
        Group group = new Group();
        group.setId(25L);

        User requester = new User();
        requester.setUsername("outsider");

        when(groupRepository.findById(25L)).thenReturn(Optional.of(group));
        when(userRepository.findByUsername("outsider")).thenReturn(Optional.of(requester));
        when(groupMemberRepository.existsByGroupAndUser(group, requester)).thenReturn(false);

        assertThrows(
                AccessDeniedException.class,
                () -> groupChatService.getMembersOfGroup(25L, "outsider")
        );
    }
}
