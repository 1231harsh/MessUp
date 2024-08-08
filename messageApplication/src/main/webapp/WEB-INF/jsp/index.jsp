<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MessUp</title>
</head>
<style>
body {
	display: flex;
	justify-content: center;
	align-items: center;
	height: 100vh;
	margin: 0;
	font-family: Arial, Helvetica, sans-serif;
}

.main-container {
	background-image: url("/images/main-back.png");
	background-size: 100% 100%;
	background-repeat: no-repeat;
	filter: blur(3.5px); 
	border: 2px solid red; 
	width: 100%;
	height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center; 
	z-index: -1;
}

form {
	position: absolute;
	text-align: center;
	background-color: #ffffff;
	box-shadow: 0 6px 10px rgb(0, 0, 0, 0.15);
	padding: 30px;
	width: 320px;
	border-radius: 10px;
}

label {
	display: block;
}

input[type="text"] {
	margin-bottom: 20px;
	box-sizing: border-box;
	padding: 12px;
	border: 2px solid rgb(108, 108, 109);
	width: calc(100% - 22px);
	border-radius: 5px;
}

input[type="submit"] {
	background-color: aquamarine;
	border: none;
	padding: 12px 20px;
	border-radius: 5px;
	font-size: 1rem;
	transition: background-color 0.3s ease;
	cursor: pointer;
}

input[type="submit"]:hover {
	background-color: #76e1c7;
}
</style>
<body>
	<div class="main-container"></div>
	<form action="home">
		<label>Enter Your Name</label><br> <input type="text" name="name"><br>
		<input type="submit">
	</form>
</body>
</html>