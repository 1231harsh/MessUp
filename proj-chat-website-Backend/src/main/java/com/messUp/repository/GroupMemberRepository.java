package com.messUp.repository;

import com.messUp.entity.Group;
import com.messUp.entity.GroupMember;
import com.messUp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    boolean existsByGroupAndUser(Group group, User sender);

    List<GroupMember> findByUser(User user);

    List<GroupMember> findByGroup(Group group);

    Optional<GroupMember> findByGroupAndUser(Group group, User user);
}
