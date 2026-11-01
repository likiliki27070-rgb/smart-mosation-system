package com.drowsiness.detection.controller;

import com.drowsiness.detection.model.User;
import com.drowsiness.detection.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Cross-origin support for local UI testing
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        if (username == null || password == null) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Username and password are required.");
            return ResponseEntity.badRequest().body(response);
        }

        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isPresent() && userOpt.get().getPassword().equals(password)) {
            User user = userOpt.get();
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("username", user.getUsername());
            response.put("fullName", user.getFullName());
            response.put("licenseNumber", user.getLicenseNumber());
            response.put("vehicleNumber", user.getVehicleNumber());
            return ResponseEntity.ok(response);
        }

        Map<String, String> response = new HashMap<>();
        response.put("error", "Invalid username or password.");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        Map<String, String> response = new HashMap<>();
        
        if (user.getUsername() == null || user.getPassword() == null) {
            response.put("error", "Username and password are required.");
            return ResponseEntity.badRequest().body(response);
        }

        if (userRepository.existsByUsername(user.getUsername())) {
            response.put("error", "Username is already taken.");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }

        userRepository.save(user);
        response.put("success", "User registered successfully.");
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
