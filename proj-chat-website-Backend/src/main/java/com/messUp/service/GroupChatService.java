package com.messUp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.messUp.DTO.CreateGroupDTO;
import com.messUp.DTO.GroupDTO;
import com.messUp.DTO.GroupMemberDTO;
import com.messUp.DTO.GroupMessageDTO;
import com.messUp.entity.*;
import com.messUp.repository.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.math.BigInteger;
import java.security.KeyFactory;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GroupChatService {

    private final GroupRepository groupRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final UserRepository userRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final GroupKeyRepository groupKeyRepository;
    private final UserPublicKeyRepository publicKeyRepository;

    public GroupChatService(GroupRepository groupRepository,
                            GroupMessageRepository groupMessageRepository,
                            UserRepository userRepository,
                            GroupMemberRepository groupMemberRepository,
                            SimpMessagingTemplate messagingTemplate,
                            GroupKeyRepository groupKeyRepository,
                            UserPublicKeyRepository publicKeyRepository) {
        this.groupRepository = groupRepository;
        this.groupMessageRepository = groupMessageRepository;
        this.userRepository = userRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.messagingTemplate = messagingTemplate;
        this.groupKeyRepository = groupKeyRepository;
        this.publicKeyRepository = publicKeyRepository;
    }

    private byte[] generateGroupKey() {
        byte[] key = new byte[32];
        new java.security.SecureRandom().nextBytes(key);
        return key;
    }

    private java.security.PublicKey jwkToPublicKey(String jwkJson) throws Exception {

        ObjectMapper mapper = new ObjectMapper();
        Map<String, String> jwk = mapper.readValue(jwkJson, Map.class);

        byte[] modulusBytes = Base64.getUrlDecoder().decode(jwk.get("n"));
        byte[] exponentBytes = Base64.getUrlDecoder().decode(jwk.get("e"));

        BigInteger modulus = new BigInteger(1, modulusBytes);
        BigInteger exponent = new BigInteger(1, exponentBytes);

        RSAPublicKeySpec spec = new RSAPublicKeySpec(modulus, exponent);
        return  KeyFactory.getInstance("RSA").generatePublic(spec);
    }

    private String encryptGroupKeyForUser(byte[] groupKey, String publicKeyJwk) throws Exception {

        java.security.PublicKey publicKey = jwkToPublicKey(publicKeyJwk);

        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");

        OAEPParameterSpec oaepParams = new OAEPParameterSpec(
                "SHA-256",
                "MGF1",
                MGF1ParameterSpec.SHA256,
                PSource.PSpecified.DEFAULT
        );

        cipher.init(Cipher.ENCRYPT_MODE, publicKey, oaepParams);

        return Base64.getEncoder().encodeToString(cipher.doFinal(groupKey));
    }



    public List<GroupMessageDTO> getMessagesForGroup(Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        return groupMessageRepository.findByGroupOrderByTimestampAsc(group)
                .stream()
                .map(this::convertDTO)
                .collect(Collectors.toList());
    }

        private GroupMessageDTO convertDTO(GroupMessage m) {
        GroupMessageDTO dto = new GroupMessageDTO();

        dto.setMessageId(m.getId());
        dto.setGroupId(m.getGroup().getId());
        dto.setMessage(m.getMessage());
        dto.setTimestamp(m.getTimestamp());
        dto.setIv(m.getIv());

        if (m.getSender() != null) {
            dto.setSender(m.getSender().getUsername());
            dto.setSenderName(m.getSender().getFirstName() + " " + m.getSender().getLastName());
        } else {
            dto.setSender("System");
            dto.setSenderName("System");
        }

        return dto;
    }

    /* =========================================================
       HANDLE LIVE MESSAGE
       ========================================================= */

    public void handleGroupMessage(GroupMessageDTO incoming) {

        Group group = groupRepository.findById(incoming.getGroupId())
                .orElseThrow(() -> new RuntimeException("Group not found"));

        User sender = userRepository.findByUsername(incoming.getSender())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!groupMemberRepository.existsByGroupAndUser(group, sender)) {
            throw new RuntimeException("User is not a member of the group");
        }

        // SAVE
        GroupMessage message = new GroupMessage();
        message.setGroup(group);
        message.setSender(sender);
        message.setMessage(incoming.getMessage());
        message.setTimestamp(LocalDateTime.now());
        message.setIv(incoming.getIv());

        groupMessageRepository.save(message);

        // BUILD OUTGOING DTO
        GroupMessageDTO outgoing = new GroupMessageDTO();
        outgoing.setMessageId(message.getId());
        outgoing.setTempId(incoming.getTempId()); // CRITICAL
        outgoing.setGroupId(group.getId());
        outgoing.setSender(sender.getUsername());
        outgoing.setSenderName(sender.getFirstName() + " " + sender.getLastName());
        outgoing.setMessage(message.getMessage());
        outgoing.setTimestamp(message.getTimestamp());
        outgoing.setIv(message.getIv());

        // BROADCAST
        messagingTemplate.convertAndSend(
                "/topic/group/" + group.getId(),
                outgoing
        );
    }

    /* =========================================================
       CREATE GROUP
       ========================================================= */

    public Long createGroup(CreateGroupDTO dto, String creatorUsername) throws Exception {

        Group group = new Group();
        group.setName(dto.getGroupName());

        User creator = userRepository.findByUsername(creatorUsername)
                .orElseThrow(() -> new RuntimeException("Creator not found"));

        group.setCreatedBy(creator);
        groupRepository.save(group);

        Set<String> memberUsernames = new LinkedHashSet<>();
        memberUsernames.add(creatorUsername);
        if (dto.getMemberUsernames() != null) {
            memberUsernames.addAll(dto.getMemberUsernames());
        }

        for (String username : memberUsernames) {
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            GroupMember gm = new GroupMember();
            gm.setUser(user);
            gm.setGroup(group);
            gm.setAdmin(creatorUsername.equals(username));
            gm.setJoinedAt(LocalDateTime.now());

            groupMemberRepository.save(gm);
        }

        byte[] groupAES = generateGroupKey();

        for (GroupMember member : groupMemberRepository.findByGroup(group)) {

            User user = member.getUser();

            PublicKey pk = publicKeyRepository.findByUser(user)
                    .orElseThrow(() -> new RuntimeException("Public key missing for " + user.getUsername()));

            String encryptedKey = encryptGroupKeyForUser(groupAES, pk.getPublicKeyJwk());

            GroupKey gk = new GroupKey();
            gk.setGroup(group);
            gk.setUser(user);
            gk.setEncryptedGroupKey(encryptedKey);

            groupKeyRepository.save(gk);
        }
        // SYSTEM MESSAGE
        GroupMessage sys = new GroupMessage();
        sys.setGroup(group);
        sys.setSender(null);
        sys.setMessage("Group created by " + creatorUsername);
        sys.setTimestamp(LocalDateTime.now());
        groupMessageRepository.save(sys);

        GroupMessageDTO sysDTO = convertDTO(sys);

        messagingTemplate.convertAndSend(
                "/topic/group/" + group.getId(),
                sysDTO
        );

        return group.getId();
    }

    /* =========================================================
       MEMBERS
       ========================================================= */

    public List<Group> getGroupsOfUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return groupMemberRepository.findByUser(user)
                .stream()
                .map(GroupMember::getGroup)
                .toList();
    }

    public List<GroupMemberDTO> getMembersOfGroup(Long groupId, String requesterUsername) {

        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        User requester = userRepository.findByUsername(requesterUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!groupMemberRepository.existsByGroupAndUser(group, requester)) {
            throw new AccessDeniedException("You are not a member of this group");
        }

        return groupMemberRepository.findByGroup(group)
                .stream()
                .map(m -> {
                    GroupMemberDTO dto = new GroupMemberDTO();
                    dto.setUsername(m.getUser().getUsername());
                    dto.setAdmin(m.isAdmin());
                    dto.setJoinedAt(m.getJoinedAt());
                    return dto;
                })
                .toList();
    }

    private void rotateGroupKey(Group group) throws Exception {

        byte[] newKey = generateGroupKey();

        List<GroupMember> members = groupMemberRepository.findByGroup(group);

        // delete old keys
        groupKeyRepository.deleteAll(groupKeyRepository.findByGroup(group));

        for (GroupMember member : members) {

            PublicKey pk = publicKeyRepository.findByUser(member.getUser())
                    .orElseThrow(() -> new RuntimeException("Public key missing"));

            String encrypted = encryptGroupKeyForUser(newKey, pk.getPublicKeyJwk());

            GroupKey gk = new GroupKey();
            gk.setGroup(group);
            gk.setUser(member.getUser());
            gk.setEncryptedGroupKey(encrypted);

            groupKeyRepository.save(gk);

            messagingTemplate.convertAndSend(
                    "/topic/group/" + group.getId() + "/key-update",
                    "KEY_UPDATED"
            );
        }
    }

    public void addMemberToGroup(Long groupId, String username, String actingUsername) throws Exception {

        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        User actingUser = userRepository.findByUsername(actingUsername)
                .orElseThrow(() -> new RuntimeException("User not found"));

        assertCanManageGroupMembers(group, actingUser);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (groupMemberRepository.existsByGroupAndUser(group, user))
            throw new RuntimeException("Already a member");

        GroupMember gm = new GroupMember();
        gm.setGroup(group);
        gm.setUser(user);
        gm.setJoinedAt(LocalDateTime.now());
        groupMemberRepository.save(gm);

        // 🔐 VERY IMPORTANT
        rotateGroupKey(group);
    }

    private void assertCanManageGroupMembers(Group group, User actingUser) {
        boolean isCreator = group.getCreatedBy() != null
                && group.getCreatedBy().getUsername().equals(actingUser.getUsername());

        boolean isAdmin = groupMemberRepository.findByGroupAndUser(group, actingUser)
                .map(GroupMember::isAdmin)
                .orElse(false);

        if (!isCreator && !isAdmin) {
            throw new AccessDeniedException("You are not allowed to manage members for this group");
        }
    }
}
