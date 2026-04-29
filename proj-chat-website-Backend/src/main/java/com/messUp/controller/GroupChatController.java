package com.messUp.controller;

import com.messUp.DTO.CreateGroupDTO;
import com.messUp.DTO.GroupMessageDTO;
import com.messUp.entity.*;
import com.messUp.repository.*;
import com.messUp.service.GroupChatService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@Controller()
@RequestMapping("/groupChat")
public class GroupChatController {
    private final GroupChatService groupChatService;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupKeyRepository groupKeyRepository;

    public GroupChatController(GroupChatService groupChatService,
                               UserRepository userRepository,
                               GroupRepository groupRepository,
                               GroupMemberRepository groupMemberRepository,
                               GroupKeyRepository groupKeyRepository) {

        this.groupChatService = groupChatService;
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupKeyRepository = groupKeyRepository;
    }

    @PostMapping("/create")
    public ResponseEntity<?> createGroup(@RequestBody CreateGroupDTO dto, Principal principal) throws Exception {
        Long gId = groupChatService.createGroup(dto, principal.getName());

        return ResponseEntity.ok("Group created with ID: " + gId);
    }

    @PostMapping("/addMember")
    public ResponseEntity<?> addMemberToGroup(@RequestParam Long groupId,
                                              @RequestParam String username,
                                              Principal principal) throws Exception {
        groupChatService.addMemberToGroup(groupId, username, principal.getName());
        return ResponseEntity.ok("Member added to group successfully.");
    }

    @MessageMapping("/groupMessage")
    public void handleGroupMessage(GroupMessageDTO dto, Principal principal) {
        dto.setSender(principal.getName()); // trust server identity
        groupChatService.handleGroupMessage(dto);
    }


    @GetMapping("/{groupId}")
    public ResponseEntity<?> getGroupMessages(@PathVariable Long groupId, Principal principal) {

        User user = userRepository.findByUsername(principal.getName()).orElseThrow();
        Group group = groupRepository.findById(groupId).orElseThrow();

        if (!groupMemberRepository.existsByGroupAndUser(group, user))
            return ResponseEntity.status(403).build();

        return ResponseEntity.ok(groupChatService.getMessagesForGroup(groupId));
    }



    @GetMapping("/getGroups")
    public ResponseEntity<?> getGroups(Principal principal) {
        return ResponseEntity.ok(groupChatService.getGroupsOfUser(principal.getName()));
    }

    @GetMapping("/getGroupMembers/{groupId}")
    public ResponseEntity<?> getGroupMembers(@PathVariable Long groupId, Principal principal) {
        return ResponseEntity.ok(groupChatService.getMembersOfGroup(groupId, principal.getName()));
    }
    @GetMapping("/keys/{groupId}")
    public ResponseEntity<?> getGroupKey(@PathVariable Long groupId, Principal principal) {

        User user = userRepository.findByUsername(principal.getName())
                .orElseThrow();

        Group group = groupRepository.findById(groupId).orElseThrow();

        if (!groupMemberRepository.existsByGroupAndUser(group, user))
            return ResponseEntity.status(403).build();

        GroupKey key = groupKeyRepository.findByGroupAndUser(group, user)
                .orElseThrow(() -> new RuntimeException("Key not found"));

        return ResponseEntity.ok(key.getEncryptedGroupKey());
    }
}
