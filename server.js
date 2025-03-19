require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

// Initialize app
const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "" }
});

const AddTaskSchema = new mongoose.Schema({
    project: String,
    taskName: String,
    status: String,
    taskDetails: String,
    remark: String,
});

// Project Schema
const ProjectSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdDate: { type: Date, required: true },
    priority: { type: String, enum: ["low", "medium", "high"], required: true },
});

const Project = mongoose.model("Project", ProjectSchema);
const User = mongoose.model("User", UserSchema);
const Task = mongoose.model("Task", AddTaskSchema)

// Default route
app.get("/", (req, res) => {
    res.send("<h2>Welcome to Jira-like Project Backend</h2>");
});

// Signup API
app.post("/api/signup", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validate required fields
        if (!name || !email || !password || !role) {
            return res.status(400).json({ msg: "All fields are required" });
        }

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "Email already exists" });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        user = new User({ name, email, password: hashedPassword, role });
        await user.save();

        res.status(201).json({ msg: "User registered successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
    }
});

// Login API
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid email address" });

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid password" });

        // Generate JWT Token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
    }
});

app.post("/api/addTasks", async (req, res) => {
    try {
        const { project, taskName, status, taskDetails, remark } = req.body;

        if (!taskName || !status || !taskDetails || !remark) {
            return res.status(400).json({ msg: "All fields are required" });
        }

        const newTask = new Task({ project, taskName, status, taskDetails, remark });
        await newTask.save();

        res.status(201).json({ msg: "Task added successfully", task: newTask });
    } catch (error) {
        res.status(500).json({ msg: "Server Error", error });
    }
});

app.get("/api/getTasks/:projectId", async (req, res) => {
    try {
        const { projectId } = req.params;

        // Find tasks assigned to the specific user
        const tasks = await Task.find({ project: projectId });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ msg: "Server Error", error });
    }
});

app.get("/api/getUsers", async (req, res) => {
    try {
        const users = await User.find({}, "_id name");
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ msg: "Server Error", error });
    }
});

// Update Task API
app.put("/api/updateTask/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { taskName, status, taskDetails, remark } = req.body;

        // Check if the task exists
        const task = await Task.findById(id);
        if (!task) {
            console.log("Task not found in database");
            return res.status(404).json({ msg: "Task not found" });
        }

        // Update the task fields
        task.taskName = taskName || task.taskName;
        task.status = status || task.status;
        task.taskDetails = taskDetails || task.taskDetails;
        task.remark = remark || task.remark;

        await task.save();

        console.log("Task updated successfully");
        res.status(200).json({ msg: "Task updated successfully", task });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ msg: "Server error", error });
    }
});

// Delete Task API
app.delete("/api/deleteTask/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if the task exists
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ msg: "Task not found" });
        }

        // Delete the task
        await Task.findByIdAndDelete(id);

        res.status(200).json({ msg: "Task deleted successfully" });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ msg: "Server error", error });
    }
});

// Add Project API
app.post("/api/addProject", async (req, res) => {
    try {
        const { projectName, user, createdDate, priority } = req.body;

        if (!projectName || !user || !createdDate || !priority) {
            return res.status(400).json({ msg: "All fields are required" });
        }

        const newProject = new Project({ projectName, user, createdDate, priority });
        await newProject.save();

        res.status(201).json({ msg: "Project added successfully", project: newProject });
    } catch (error) {
        console.error("Error adding project:", error);
        res.status(500).json({ msg: "Server Error", error });
    }
});

// Get All Projects API
app.get("/api/getProjects", async (req, res) => {
    try {
        const projects = await Project.find().populate("user", "name"); // Populate user details
        res.status(200).json(projects);
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).json({ msg: "Server Error", error });
    }
});

// Middleware for protected routes
const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ msg: "No token, authorization denied" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ msg: "Invalid token" });
    }
};

// Protected Route Example
app.get("/api/protected", authMiddleware, (req, res) => {
    res.json({ msg: "Access granted", user: req.user });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
