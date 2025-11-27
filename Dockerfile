# Stage 1: Build the Spring Boot app
FROM maven:3.8.5-openjdk-17 AS build

WORKDIR /app

# Copy only the backend folder into container
COPY proj-chat-website-Backend /app

# Build the backend
RUN mvn clean package -DskipTests

# Stage 2: Run the app with JDK Slim
# FROM openjdk:17-jdk-slim
FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

CMD ["java", "-jar", "app.jar"]
