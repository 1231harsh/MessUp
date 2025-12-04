package com.messUp.service;

import com.messUp.DTO.UserDTO;
import com.messUp.entity.User;
import com.messUp.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserDTO getUser(Long id) {
        return userRepository.findById(id)
                .map(user -> new UserDTO(user.getId(), user.getUsername(), user.getProfilePicture(),user.getEmail(),
                        user.getProfilePictureContentType(), user.getFirstName(), user.getLastName(),
                        user.getDescription(), user.getPhoneNumber()))
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public UserDTO searchUser(String username, String email) {
        User user;

        if(username != null) {
            user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new RuntimeException("User not found with username: " + username));
        } else if(email != null) {
            user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found with email: " + email));
        } else {
            throw new IllegalArgumentException("Either username or email must be provided for search.");
        }

        return mapToDTO(user);
    }

    public UserDTO mapToDTO(User user) {
        UserDTO userDTO =new UserDTO(user.getId(), user.getUsername(), user.getProfilePicture(),user.getProfilePictureContentType(), user.getFirstName(), user.getLastName(), user.getDescription(), user.getPhoneNumber(), user.getEmail());
        userDTO.setId(user.getId());
        userDTO.setUsername(user.getUsername());
        userDTO.setProfilePicture(user.getProfilePicture());
        userDTO.setProfilePictureContentType(user.getProfilePictureContentType());
        userDTO.setFirstName(user.getFirstName());
        userDTO.setLastName(user.getLastName());
        userDTO.setDescription(user.getDescription());
        userDTO.setPhoneNumber(user.getPhoneNumber());
        return userDTO;
    }

    public Long getIdByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(User::getId)
                .orElseThrow(() -> new RuntimeException("User not found with username: " + username));
    }

//    public void updateProfilePicture(Long userId, String imageUrl) {
//        User user = userRepository.findById(userId)
//                .orElseThrow(() -> new RuntimeException("User not found with ID: " + userId));
//        user.setProfilePicture(imageUrl);
//        userRepository.save(user);
//    }

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found with username: " + username));
    }

    public UserDTO getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found with username: " + username));
        return mapToDTO(user);
    }

    public void saveUser(User user) {
        userRepository.save(user);
    }
}
