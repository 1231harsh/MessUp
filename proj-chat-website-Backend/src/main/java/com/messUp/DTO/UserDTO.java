package com.messUp.DTO;

import lombok.Data;

@Data
public class UserDTO {
    private Long id;
    private String username;
    private String email;
    private byte[] profilePicture;
    private String profilePictureContentType;
    private String firstName;
    private String lastName;
    private String description;
    private String phoneNumber;

    public UserDTO(Long id, String username, byte[] profilePicture,
                   String profilePictureContentType, String firstName,
                   String lastName, String description, String phoneNumber, String email) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.profilePicture = profilePicture;
        this.profilePictureContentType = profilePictureContentType;
        this.firstName = firstName;
        this.lastName = lastName;
        this.description = description;
        this.phoneNumber = phoneNumber;
    }
}
