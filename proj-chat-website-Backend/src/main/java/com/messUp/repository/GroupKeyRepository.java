package com.messUp.repository;

import com.messUp.entity.Group;
import com.messUp.entity.GroupKey;
import com.messUp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupKeyRepository extends JpaRepository<GroupKey, Long> {

    List<GroupKey> findByUser(User user);

    Optional<GroupKey> findByGroupAndUser(Group group, User user);

    List<GroupKey> findByGroup(Group group);
}
