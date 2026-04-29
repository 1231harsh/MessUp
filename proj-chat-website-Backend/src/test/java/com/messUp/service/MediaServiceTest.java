package com.messUp.service;

import com.messUp.repository.MediaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MediaServiceTest {

    @Mock
    private MediaRepository mediaRepository;

    private MediaService mediaService;

    @BeforeEach
    void setUp() {
        mediaService = new MediaService(mediaRepository);
    }

    @Test
    void storeEncryptedImageRejectsUnsupportedContentType() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "encrypted.bin",
                "application/octet-stream",
                new byte[]{1, 2, 3}
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> mediaService.storeEncryptedImage(file, "receiver", "sender", "application/pdf")
        );

        verify(mediaRepository, never()).save(any());
    }

    @Test
    void storeEncryptedImageRejectsOversizedPayload() {
        byte[] largePayload = new byte[5 * 1024 * 1024 + 1];
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "encrypted.bin",
                "application/octet-stream",
                largePayload
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> mediaService.storeEncryptedImage(file, "receiver", "sender", "image/png")
        );

        verify(mediaRepository, never()).save(any());
    }
}
