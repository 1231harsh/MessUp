<%@ page pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>	
<!DOCTYPE html>
<html>
<head>
<link rel="stylesheet" href="${pageContext.request.contextPath}/css/style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" integrity="sha512-Kc323vGBEqzTmouAECnVceyQqyqdsSiqLQISBL29aUW4U/M7pSPA/gEUZQqv1cwx4OnYxTxve5UMg5GT6L4JJg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
<script
	src="https://cdn.jsdelivr.net/npm/sockjs-client/dist/sockjs.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/stompjs/lib/stomp.min.js"></script>
<title>Chat</title>
</head>
<body>
 <div id="profile">
        <div id="profile-info">
            <h2 id="username"><%
                    String name = (String) session.getAttribute("userName");
					String colour= (String) session.getAttribute("color");
                %>
				<%= name %>
			</h2>
				<div id="status-container">
                	<span id="status-icon" class="fa-solid fa-circle"></span>
                	<p id="status">Online</p>
                </div>
        </div>
    </div>
	<div id="messages">
	
	</div>
	<div id="message-container">
            <input id="message" type="text" placeholder="Type a message...">
            <button onclick="sendMessage()">
                <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>
	<script>
		const socket = new SockJS('http://localhost:8080/chat');
		const stompClient = Stomp.over(socket);
		var name="<%= name %>";
		var coloured="<%= colour %>";
		stompClient.connect({}, function(frame) {
			console.log('Connected: ' + frame);
			stompClient.subscribe('/topic/sentMeth', function(messageOutput) {
				 const message = JSON.parse(messageOutput.body);
				showMessage(message);
			});
		});
		
		function sendMessage() {
			const messageInput = document.getElementById('message');
			const message = {
					mess_content:messageInput.value,
					name_string:name,
					color:coloured
			}
			console.log(message);

			stompClient.send("/app/sent", {}, JSON.stringify(message));

			messageInput.value = '';
		}
		function showMessage(message) {
			const messagesDiv = document.getElementById('messages');
			const messageElement = document.createElement('div');
			
		    const nameSpan = document.createElement('div');
		    nameSpan.className = 'message-name';
		    nameSpan.textContent = message.name_string;
		    
		    
            if(message.name_string.localeCompare(name)==0){
				messageElement.className = 'messageUser';
				nameSpan.style.color=message.color;
		    }
		    else{
		    	messageElement.className = 'messageSender';
		    	nameSpan.style.color="#FF0000";
		    }
            
		    const contentSpan = document.createElement('div');
		    contentSpan.className = 'message-content';
		    contentSpan.textContent = message.mess_content;
		    
		    
            
            
		    messageElement.appendChild(nameSpan);
		    messageElement.appendChild(contentSpan);
		    
			messagesDiv.appendChild(messageElement);
		}
	</script>
</body>
</html>