<?php
session_start();
if (!isset($_SESSION['admin'])) {
    header("Location: login.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head><title>Admin Panel</title><link rel="stylesheet" href="style.css"></head>
<body>
    <div class="container" style="border-left: 5px solid green;">
        <h1>Selamat Datang, Admin!</h1>
        <p>Jika kamu melihat halaman ini, berarti kamu berhasil menembus sistem login.</p>
        <p><b>FLAG{SQLI_BYPASS_SUCCESS}</b></p>
        <a href="index.php">Logout</a>
    </div>
</body>
</html>