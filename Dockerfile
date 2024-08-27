
FROM openjdk:21-jdk


WORKDIR /app


COPY target/messageApplication-0.0.1-SNAPSHOT.jar /app/messageApplication.jar


ENTRYPOINT ["java", "-jar", "/app/messageApplication.jar"]
