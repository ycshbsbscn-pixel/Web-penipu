<?php
session_start();
if (isset($_SESSION['admin'])) {
    header("Location: admin.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head><title>Login Admin</title><link rel="stylesheet" href="style.css"></head>
<body>
    <div class="container">
        <h1>Login Admin</h1>
        <?php
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {
            $user = $_POST['username'];
            $pass = $_POST['password'];
            
            // KERENTANAN: Autentikasi lemah, bisa di-bypass pakai ' OR '1'='1
            $db = new SQLite3('toko.db');
            $query = "SELECT * FROM users WHERE username='$user' AND password='$pass'";
            $result = $db->query($query);
            
            if ($result && $result->fetchArray()) {
                $_SESSION['admin'] = true;
                header("Location: admin.php");
                exit;
            } else {
                echo "<p style='color:red'>Login Gagal! (Coba bypass dengan payload SQLi)</p>";
            }
        }
        ?>
        <form method="POST">
            <input type="text" name="username" placeholder="Username"><br>
            <input type="password" name="password" placeholder="Password"><br>
            <button type="submit">Login</button>
        </form>
        <a href="index.php">Kembali</a>
    </div>
</body>
</html>