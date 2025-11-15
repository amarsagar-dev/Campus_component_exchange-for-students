-- ==========================================
--  CAMPUS EXCHANGE SYSTEM - FINAL SQL
--  Author: Adarsh L (PES2UG23CS025)
--  Fully ACID-Compliant Marketplace Database
-- ==========================================

CREATE DATABASE IF NOT EXISTS campus_exchange;
USE campus_exchange;

-- ==========================================
-- USERS TABLE
-- ==========================================
DROP TABLE IF EXISTS Users;
CREATE TABLE Users (
  UserId INT AUTO_INCREMENT PRIMARY KEY,
  FullName VARCHAR(100) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  PasswordHash VARCHAR(255) NOT NULL,
  Phone VARCHAR(20),
  Department VARCHAR(100),
  CollegeId VARCHAR(50),
  Role ENUM('student','admin') DEFAULT 'student',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================
-- CATEGORIES TABLE
-- ==========================================
DROP TABLE IF EXISTS Categories;
CREATE TABLE Categories (
  CategoryId INT AUTO_INCREMENT PRIMARY KEY,
  CategoryName VARCHAR(100) UNIQUE NOT NULL
) ENGINE=InnoDB;

-- ==========================================
-- LISTINGS TABLE
-- ==========================================
DROP TABLE IF EXISTS Listings;
CREATE TABLE Listings (
  ListingId INT AUTO_INCREMENT PRIMARY KEY,
  SellerId INT NOT NULL,
  Title VARCHAR(200) NOT NULL,
  Description TEXT,
  CategoryId INT,
  Price DECIMAL(10,2) NOT NULL,
  ItemCondition ENUM('New','Like New','Good','Fair','For Parts') DEFAULT 'Good',
  Status ENUM('Available','Reserved','Sold','Removed') DEFAULT 'Available',
  Location VARCHAR(150),
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (SellerId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (CategoryId) REFERENCES Categories(CategoryId) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==========================================
-- LISTING IMAGES TABLE
-- ==========================================
DROP TABLE IF EXISTS ListingImages;
CREATE TABLE ListingImages (
  ImageId INT AUTO_INCREMENT PRIMARY KEY,
  ListingId INT NOT NULL,
  ImageURL VARCHAR(500) NOT NULL,
  IsPrimary BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- MESSAGES TABLE
-- ==========================================
DROP TABLE IF EXISTS Messages;
CREATE TABLE Messages (
  MessageId INT AUTO_INCREMENT PRIMARY KEY,
  ListingId INT NOT NULL,
  FromUserId INT NOT NULL,
  ToUserId INT NOT NULL,
  MessageText TEXT NOT NULL,
  SentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  IsRead BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE,
  FOREIGN KEY (FromUserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (ToUserId) REFERENCES Users(UserId) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- OFFERS TABLE
-- ==========================================
DROP TABLE IF EXISTS Offers;
CREATE TABLE Offers (
  OfferId INT AUTO_INCREMENT PRIMARY KEY,
  ListingId INT NOT NULL,
  BuyerId INT NOT NULL,
  OfferedPrice DECIMAL(10,2) NOT NULL,
  Status ENUM('Pending','Accepted','Rejected','Withdrawn') DEFAULT 'Pending',
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE,
  FOREIGN KEY (BuyerId) REFERENCES Users(UserId) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- WISHLIST TABLE
-- ==========================================
DROP TABLE IF EXISTS Wishlist;
CREATE TABLE Wishlist (
  WishlistId INT AUTO_INCREMENT PRIMARY KEY,
  UserId INT NOT NULL,
  ListingId INT NOT NULL,
  AddedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(UserId, ListingId),
  FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- TRANSACTIONS TABLE (FIXED & ACID SAFE)
-- ==========================================
DROP TABLE IF EXISTS Transactions;
CREATE TABLE Transactions (
  TransactionId INT AUTO_INCREMENT PRIMARY KEY,
  ListingId INT NOT NULL,
  BuyerId INT,    -- nullable for ON DELETE SET NULL
  SellerId INT,   -- nullable for ON DELETE SET NULL
  Amount DECIMAL(10,2) NOT NULL,
  PaymentMethod ENUM('Cash','UPI','Card','Other') DEFAULT 'Cash',
  Status ENUM('Completed','Failed','Refunded') DEFAULT 'Completed',
  TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE,
  FOREIGN KEY (BuyerId) REFERENCES Users(UserId) ON DELETE SET NULL,
  FOREIGN KEY (SellerId) REFERENCES Users(UserId) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==========================================
-- FEEDBACK TABLE
-- ==========================================
DROP TABLE IF EXISTS Feedback;
CREATE TABLE Feedback (
  FeedbackId INT AUTO_INCREMENT PRIMARY KEY,
  FromUserId INT NOT NULL,
  ToUserId INT NOT NULL,
  ListingId INT,
  Rating TINYINT CHECK (Rating BETWEEN 1 AND 5),
  Comments TEXT,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (FromUserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (ToUserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE SET NULL
) ENGINE=InnoDB;

DROP TABLE IF EXISTS Transactions;
CREATE TABLE Transactions (
  TransactionId INT AUTO_INCREMENT PRIMARY KEY,
  ListingId INT NOT NULL,
  BuyerId INT,
  SellerId INT,
  Amount DECIMAL(10,2) NOT NULL,
  PaymentMethod ENUM('Cash','UPI','Card','Other') DEFAULT 'UPI',
  Status ENUM('Completed','Failed','Refunded') DEFAULT 'Completed',
  TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE,
  FOREIGN KEY (BuyerId) REFERENCES Users(UserId) ON DELETE SET NULL,
  FOREIGN KEY (SellerId) REFERENCES Users(UserId) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_title ON Listings(Title);
CREATE INDEX idx_category ON Listings(CategoryId);
CREATE INDEX idx_status ON Listings(Status);
CREATE INDEX idx_buyer ON Transactions(BuyerId);
CREATE INDEX idx_seller ON Transactions(SellerId);

-- ==========================================
-- TRIGGERS (INTEGRITY & AUTOMATION)
-- ==========================================
DELIMITER $$

CREATE TRIGGER trg_after_transaction_insert
AFTER INSERT ON Transactions
FOR EACH ROW
BEGIN
  UPDATE Listings
  SET Status = 'Sold'
  WHERE ListingId = NEW.ListingId;
END$$

CREATE TRIGGER trg_before_transaction_insert
BEFORE INSERT ON Transactions
FOR EACH ROW
BEGIN
  DECLARE stat VARCHAR(20);
  SELECT Status INTO stat FROM Listings WHERE ListingId = NEW.ListingId;
  IF stat = 'Sold' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '❌ Item already sold.';
  END IF;
END$$

CREATE TRIGGER trg_listing_update
BEFORE UPDATE ON Listings
FOR EACH ROW
BEGIN
  SET NEW.UpdatedAt = CURRENT_TIMESTAMP;
END$$

CREATE TRIGGER trg_prevent_duplicate_offer
BEFORE INSERT ON Offers
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1 FROM Offers
    WHERE ListingId = NEW.ListingId
      AND BuyerId = NEW.BuyerId
      AND Status = 'Pending'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '⚠ You already have a pending offer.';
  END IF;
END$$

CREATE TRIGGER trg_user_delete
AFTER DELETE ON Users
FOR EACH ROW
BEGIN
  UPDATE Listings SET Status='Removed' WHERE SellerId = OLD.UserId;
END$$

CREATE TRIGGER trg_listing_delete
AFTER DELETE ON Listings
FOR EACH ROW
BEGIN
  DELETE FROM Wishlist WHERE ListingId = OLD.ListingId;
  DELETE FROM Offers WHERE ListingId = OLD.ListingId;
  DELETE FROM Messages WHERE ListingId = OLD.ListingId;
END$$
DELIMITER ;

-- ==========================================
-- STORED PROCEDURES (ACID COMPLIANT)
-- ==========================================
DELIMITER $$

CREATE PROCEDURE AddListing(
  IN p_SellerId INT,
  IN p_Title VARCHAR(200),
  IN p_Description TEXT,
  IN p_CategoryId INT,
  IN p_Price DECIMAL(10,2),
  IN p_ItemCondition ENUM('New','Like New','Good','Fair','For Parts'),
  IN p_Location VARCHAR(150)
)
BEGIN
  INSERT INTO Listings (SellerId, Title, Description, CategoryId, Price, ItemCondition, Location)
  VALUES (p_SellerId, p_Title, p_Description, p_CategoryId, p_Price, p_ItemCondition, p_Location);
END$$

CREATE PROCEDURE PurchaseListing(
  IN p_ListingId INT,
  IN p_BuyerId INT,
  IN p_Amount DECIMAL(10,2),
  IN p_PaymentMethod ENUM('Cash','UPI','Card','Other')
)
BEGIN
  DECLARE s_id INT;
  DECLARE s_status VARCHAR(20);
  START TRANSACTION;
  SELECT SellerId, Status INTO s_id, s_status FROM Listings WHERE ListingId = p_ListingId FOR UPDATE;
  IF s_status = 'Sold' THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '❌ This item is already sold.';
  ELSE
    INSERT INTO Transactions (ListingId, BuyerId, SellerId, Amount, PaymentMethod)
    VALUES (p_ListingId, p_BuyerId, s_id, p_Amount, p_PaymentMethod);
    UPDATE Listings SET Status = 'Sold' WHERE ListingId = p_ListingId;
    COMMIT;
  END IF;
END$$

CREATE PROCEDURE AddFeedback(
  IN p_FromUserId INT,
  IN p_ToUserId INT,
  IN p_ListingId INT,
  IN p_Rating TINYINT,
  IN p_Comments TEXT
)
BEGIN
  INSERT INTO Feedback (FromUserId, ToUserId, ListingId, Rating, Comments)
  VALUES (p_FromUserId, p_ToUserId, p_ListingId, p_Rating, p_Comments);
END$$

CREATE PROCEDURE MakeOffer(
  IN p_ListingId INT,
  IN p_BuyerId INT,
  IN p_OfferedPrice DECIMAL(10,2)
)
BEGIN
  INSERT INTO Offers (ListingId, BuyerId, OfferedPrice)
  VALUES (p_ListingId, p_BuyerId, p_OfferedPrice);
END$$
DELIMITER ;

-- ==========================================
-- FUNCTION: Average Seller Rating
-- ==========================================
DELIMITER $$
CREATE FUNCTION GetSellerRating(p_SellerId INT)
RETURNS DECIMAL(3,2)
DETERMINISTIC
BEGIN
  DECLARE avg_r DECIMAL(3,2);
  SELECT AVG(Rating) INTO avg_r FROM Feedback WHERE ToUserId = p_SellerId;
  RETURN IFNULL(avg_r, 0);
END$$
DELIMITER ;

-- ==========================================
-- SAMPLE DATA
-- ==========================================
INSERT INTO Categories (CategoryName) VALUES
('Electronics'),('Books'),('Microcontrollers'),('Sensors'),('Tools');

INSERT INTO Users (FullName, Email, PasswordHash, Phone, Department, CollegeId, Role)
VALUES
  ('Adarsh L','adarsh@campus.edu','HASHEDPASS','9999999999','CSE','PES2UG23CS025','student'),
('Amar Sagar','amarsagar@campus.edu','HASHEDPASS','8888888888','ECE','PES2UG23CS052','student');

INSERT INTO Listings (SellerId, Title, Description, CategoryId, Price, ItemCondition, Location)
VALUES
(1,'Arduino UNO Board','Perfect working condition',3,450.00,'Like New','Block A'),
(2,'IR Sensor Module','Brand new unused sensor',4,150.00,'New','Main Campus');

CREATE TABLE Feedback (
  FeedbackId INT AUTO_INCREMENT PRIMARY KEY,
  FromUserId INT NOT NULL,
  ToUserId INT NOT NULL,
  ListingId INT,
  Rating TINYINT CHECK (Rating BETWEEN 1 AND 5),
  Comments TEXT,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (FromUserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (ToUserId) REFERENCES Users(UserId) ON DELETE CASCADE,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE SET NULL
);

-- ==========================================
-- TRANSACTIONS TABLE (FINAL - ACID SAFE)
-- ==========================================
DROP TABLE IF EXISTS Transactions;
CREATE TABLE Transactions (
  TransactionId INT AUTO_INCREMENT PRIMARY KEY,
  ListingId INT NOT NULL,
  BuyerId INT,
  SellerId INT,
  Amount DECIMAL(10,2) NOT NULL,
  PaymentMethod ENUM('Cash','UPI','Card','Other') DEFAULT 'UPI',
  Status ENUM('Completed','Failed','Refunded') DEFAULT 'Completed',
  TransactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ListingId) REFERENCES Listings(ListingId) ON DELETE CASCADE,
  FOREIGN KEY (BuyerId) REFERENCES Users(UserId) ON DELETE SET NULL,
  FOREIGN KEY (SellerId) REFERENCES Users(UserId) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ==========================================
-- TRIGGERS (TRANSACTION-AWARE)
-- ==========================================
DELIMITER $$

-- Prevent duplicate purchase for already sold items
CREATE TRIGGER trg_before_transaction_insert
BEFORE INSERT ON Transactions
FOR EACH ROW
BEGIN
  DECLARE stat VARCHAR(20);
  SELECT Status INTO stat FROM Listings WHERE ListingId = NEW.ListingId;
  IF stat = 'Sold' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '❌ This item is already sold.';
  END IF;
END$$

-- Automatically mark listing as sold after successful transaction
CREATE TRIGGER trg_after_transaction_insert
AFTER INSERT ON Transactions
FOR EACH ROW
BEGIN
  UPDATE Listings
  SET Status = 'Sold'
  WHERE ListingId = NEW.ListingId;
END$$

DELIMITER ;


USE campus_exchange;
SHOW TABLES;
select *from feedback;
SELECT * FROM Users;
SELECT * FROM Listings;
select *from transactions;

SHOW TRIGGERS;
SHOW PROCEDURE STATUS WHERE Db='campus_exchange';
SHOW FUNCTION STATUS WHERE Db='campus_exchange';
show databases;
