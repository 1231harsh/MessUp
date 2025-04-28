module com.mu.projchatwebsite {
    requires javafx.controls;
    requires javafx.fxml;


    opens com.mu.projchatwebsite to javafx.fxml;
    exports com.mu.projchatwebsite;
}