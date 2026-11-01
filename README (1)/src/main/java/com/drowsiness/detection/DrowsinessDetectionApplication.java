package com.drowsiness.detection;

import java.time.LocalDateTime;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import com.drowsiness.detection.model.DrowsinessLog;
import com.drowsiness.detection.model.User;
import com.drowsiness.detection.repository.DrowsinessLogRepository;
import com.drowsiness.detection.repository.UserRepository;

@SpringBootApplication
public class DrowsinessDetectionApplication {

    public static void main(String[] args) {
        SpringApplication.run(DrowsinessDetectionApplication.class, args);
    }

    @Bean
    public CommandLineRunner demoData(UserRepository userRepo, DrowsinessLogRepository logRepo) {
        return args -> {
            // Seed a default driver if not exists
            if (!userRepo.existsByUsername("driver")) {
                User defaultDriver = new User(
                    "driver",
                    "password123", // Keep plain for demo simplicity, or MD5 if required (no complex Spring Security needed to ensure quick compile)
                    "John Doe",
                    "TN-15-2023-0089123",
                    "TN-30-AX-4567"
                );
                userRepo.save(defaultDriver);
                System.out.println("Default user 'driver' created. Password: 'password123'");
            }

            // Seed some historic drowsiness logs if database is empty
            if (logRepo.count() == 0) {
                LocalDateTime now = LocalDateTime.now();
                
                // Add logs across the last 3 days
                logRepo.save(new DrowsinessLog("driver", now.minusDays(2).withHour(14).withMinute(30), "YAWNING", 2.5, 11.4530, 77.4367, "Gobichettipalayam, Erode District, Tamilnadu", "Resolved"));
                logRepo.save(new DrowsinessLog("driver", now.minusDays(2).withHour(16).withMinute(15), "EYES_CLOSED", 3.1, 11.4530, 77.4367, "Gobichettipalayam, Erode District, Tamilnadu", "Resolved"));
                
                logRepo.save(new DrowsinessLog("driver", now.minusDays(1).withHour(22).withMinute(10), "EYES_CLOSED", 4.2, 11.4530, 77.4367, "Gobichettipalayam, Erode District, Tamilnadu", "Resolved"));
                logRepo.save(new DrowsinessLog("driver", now.minusDays(1).withHour(23).withMinute(45), "MICROSLEEP", 5.8, 11.4530, 77.4367, "Gobichettipalayam, Erode District, Tamilnadu", "Resolved"));
                
                logRepo.save(new DrowsinessLog("driver", now.minusHours(4).withMinute(12), "YAWNING", 1.8, 11.4530, 77.4367, "Gobichettipalayam, Erode District, Tamilnadu", "Resolved"));
                logRepo.save(new DrowsinessLog("driver", now.minusHours(2).withMinute(45), "EYES_CLOSED", 3.5, 11.4530, 77.4367, "Gobichettipalayam, Erode District, Tamilnadu", "Resolved"));
                
                System.out.println("Seed drowsiness logs created successfully.");
            }
        };
    }
}
