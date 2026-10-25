<!DOCTYPE html>
<html lang="id">
<head><title>Cari Produk</title><link rel="stylesheet" href="style.css"></head>
<body>
    <div class="container">
        <h1>Pencarian Produk</h1>
        <form method="GET">
            <input type="text" name="q" placeholder="Ketik nama produk...">
            <button type="submit">Cari</button>
        </form>
        <div class="result">
            <?php
            if (isset($_GET['q'])) {
                $q = $_GET['q'];
                // Membuat database SQLite otomatis di memori/file
                $db = new SQLite3('toko.db');
                $db->exec("CREATE TABLE IF NOT EXISTS produk (id INTEGER PRIMARY KEY, nama TEXT, harga INT)");
                // Isi data dummy jika kosong
                $count = $db->querySingle("SELECT count(*) FROM produk");
                if ($count == 0) {
                    $db->exec("INSERT INTO produk (nama, harga) VALUES ('Laptop', 5000), ('Mouse', 100), ('Keyboard', 300)");
                }

                echo "<p>Hasil pencarian untuk: <b>" . htmlspecialchars($q) . "</b></p>";
                
                // KERENTANAN: Query langsung tanpa prepared statement
                $query = "SELECT * FROM produk WHERE nama LIKE '%$q%'";
                echo "<code>Query: $query</code><br><br>";
                
                $results = $db->query($query);
                if ($results) {
                    while ($row = $results->fetchArray()) {
                        echo "<div>ID: {$row['id']} | Nama: {$row['nama']} | Harga: \${$row['harga']}</div>";
                    }
                } else {
                    echo "<p style='color:red'>Error: " . $db->lastErrorMsg() . "</p>";
                }
            }
            ?>
        </div>
        <a href="index.php">Kembali</a>
    </div>
</body>
</html>