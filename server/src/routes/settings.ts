import express from 'express';
import { videoDb } from '../services/database';

const router = express.Router();

router.get('/pomodoro', (_req, res) => {
  try {
    const settings = videoDb.getPomodoroSettings();
    res.json(settings);
  } catch (error) {
    console.error('[Pomodoro API] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch pomodoro settings' });
  }
});

router.post('/pomodoro', (req, res) => {
  try {
    const { workTime, shortBreakTime, longBreakTime, cyclesBeforeLongBreak } = req.body;
    
    // Validate
    const settings = {
      workTime: Math.max(1, Math.round(Number(workTime) || 25)),
      shortBreakTime: Math.max(1, Math.round(Number(shortBreakTime) || 5)),
      longBreakTime: Math.max(1, Math.round(Number(longBreakTime) || 15)),
      cyclesBeforeLongBreak: Math.max(1, Math.round(Number(cyclesBeforeLongBreak) || 4)),
    };

    const saved = videoDb.savePomodoroSettings(settings);
    res.json(saved);
  } catch (error) {
    console.error('[Pomodoro API] Save error:', error);
    res.status(500).json({ error: 'Failed to save pomodoro settings' });
  }
});

router.get('/pomodoro/tasks', (_req, res) => {
  try {
    const tasks = videoDb.getPomodoroTasks();
    res.json(tasks);
  } catch (error) {
    console.error('[Pomodoro API] Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch pomodoro tasks' });
  }
});

router.post('/pomodoro/tasks', (req, res) => {
  try {
    const task = req.body;
    const saved = videoDb.addPomodoroTask({
      id: task.id || Date.now().toString(),
      name: task.name,
    });
    res.json(saved);
  } catch (error) {
    console.error('[Pomodoro API] Add task error:', error);
    res.status(500).json({ error: 'Failed to add pomodoro task' });
  }
});

router.put('/pomodoro/tasks/:id', (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updated = videoDb.updatePomodoroTask(id, updates);
    res.json(updated);
  } catch (error) {
    console.error('[Pomodoro API] Update task error:', error);
    res.status(500).json({ error: 'Failed to update pomodoro task' });
  }
});

router.delete('/pomodoro/tasks/:id', (req, res) => {
  try {
    videoDb.deletePomodoroTask(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Pomodoro API] Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete pomodoro task' });
  }
});

router.post('/pomodoro/tasks/clear', (_req, res) => {
  try {
    videoDb.clearCompletedPomodoroTasks();
    res.json({ success: true });
  } catch (error) {
    console.error('[Pomodoro API] Clear tasks error:', error);
    res.status(500).json({ error: 'Failed to clear pomodoro tasks' });
  }
});

export default router;
