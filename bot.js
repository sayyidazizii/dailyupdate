// Smart Commit Bot (Fixed Version)
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const git = simpleGit();

// Lock file untuk prevent concurrent runs
const LOCK_FILE = path.join(__dirname, '.bot-lock');
const MAX_LOCK_AGE = 5 * 60 * 1000; // 5 minutes

function acquireLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const lockTime = fs.readFileSync(LOCK_FILE, 'utf8');
            const age = Date.now() - parseInt(lockTime);
            
            if (age < MAX_LOCK_AGE) {
                return false; // Lock masih aktif
            }
            // Lock expired, hapus
            fs.unlinkSync(LOCK_FILE);
        }
        
        fs.writeFileSync(LOCK_FILE, Date.now().toString());
        return true;
    } catch (error) {
        return false;
    }
}

function releaseLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    } catch (error) {
        // Ignore cleanup errors
    }
}

const commitMessages = [
    "📝 Daily activity update",
    "🔄 Regular maintenance commit",
    "✨ Fresh daily changes",
    "🚀 Automated sync update",
    "📊 Progress tracking update",
    "🔧 System maintenance log",
    "💫 Daily workflow commit",
    "⚡ Quick status update",
    "🌟 Regular check-in",
    "🎯 Daily milestone update",
    "🔥 Continuous improvement",
    "💡 Daily insights update",
    "🚧 Work in progress sync",
    "📈 Performance tracking",
    "🎨 Daily refinements",
    "🛠️ Routine optimization",
    "💪 Daily grind update",
    "🌈 Creative progress sync",
    "⭐ Excellence pursuit update",
    "🏆 Achievement tracking"
];

const activityTypes = [
    "code review session",
    "feature development",
    "bug fixing",
    "documentation update",
    "performance optimization",
    "testing improvements",
    "refactoring work",
    "security enhancements",
    "UI/UX improvements",
    "database optimization",
    "API development",
    "deployment preparation"
];

function getRandomCommitMessage() {
    return commitMessages[Math.floor(Math.random() * commitMessages.length)];
}

function getRandomActivity() {
    return activityTypes[Math.floor(Math.random() * activityTypes.length)];
}

function generateBranchName(activity) {
    return `auto/${activity.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
}

function shouldCommitNow() {
    const today = new Date().toDateString();
    const trackingFile = path.join(__dirname, 'commit_tracking.json');

    let tracking = {};
    if (fs.existsSync(trackingFile)) {
        try {
            tracking = JSON.parse(fs.readFileSync(trackingFile, 'utf8'));
        } catch (error) {
            tracking = {};
        }
    }

    if (tracking.date !== today) {
        tracking = {
            date: today,
            count: 0,
            targetCommits: Math.floor(Math.random() * 8) + 8 // 8–15
        };

        const filePath = path.join(__dirname, 'daily_update.txt');
        const timestamp = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
        fs.appendFileSync(filePath, `\n🌅 === NEW DAY: ${timestamp} === Target: ${tracking.targetCommits} commits ===\n\n`);
    }

    const shouldCommit = tracking.count < tracking.targetCommits && Math.random() > 0.3;

    if (shouldCommit) {
        tracking.count += 1;
    }

    fs.writeFileSync(trackingFile, JSON.stringify(tracking, null, 2));

    console.log(`Today's progress: ${tracking.count}/${tracking.targetCommits} commits`);
    return shouldCommit;
}

function addLog(message, type = 'INFO') {
    const filePath = path.join(__dirname, 'daily_update.txt');
    const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const logEntry = `[${timestamp} WIB] [${type}] ${message}\n`;
    fs.appendFileSync(filePath, logEntry);
    console.log(`${type}: ${message}`);
}

function execSafeSync(command, options = {}) {
    try {
        const result = execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            ...options
        });
        return { success: true, output: result.trim() };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            output: error.stdout ? error.stdout.trim() : ''
        };
    }
}

async function syncWithRemote() {
    try {
        await git.fetch();
        await git.reset(['--hard', 'origin/main']);
        addLog('🔄 Synced with remote main branch', 'SYNC');
        return true;
    } catch (error) {
        addLog(`❌ Failed to sync with remote: ${error.message}`, 'ERROR');
        return false;
    }
}

async function safeStashAndCheckout(targetBranch) {
    try {
        // In GitHub Actions, workspace is clean, so minimal stashing needed
        if (process.env.GITHUB_ACTIONS) {
            await git.checkout(targetBranch);
            addLog(`🔄 Switched to branch: ${targetBranch}`, 'BRANCH');
        } else {
            // Stash everything including untracked files for local runs
            await git.stash(['--include-untracked']);
            addLog('📦 Stashed all changes', 'STASH');
            
            await git.checkout(targetBranch);
            addLog(`🔄 Switched to branch: ${targetBranch}`, 'BRANCH');
        }
        
        return true;
    } catch (error) {
        addLog(`❌ Failed to switch to ${targetBranch}: ${error.message}`, 'ERROR');
        return false;
    }
}

async function safeStashPop() {
    try {
        // Skip stash pop in GitHub Actions
        if (process.env.GITHUB_ACTIONS) {
            return true;
        }
        
        const stashList = await git.stashList();
        if (stashList.total > 0) {
            await git.stash(['pop']);
            addLog('📦 Restored stashed changes', 'STASH');
        }
        return true;
    } catch (error) {
        addLog(`⚠️ Failed to restore stash: ${error.message}`, 'WARNING');
        return false;
    }
}

async function makeCommit() {
    // Skip lock check in GitHub Actions (each run is isolated)
    if (process.env.GITHUB_ACTIONS) {
        console.log('🔄 Running in GitHub Actions - skipping lock check');
    } else if (!acquireLock()) {
        console.log('🔒 Another bot instance is running, skipping...');
        return;
    }

    try {
        if (!shouldCommitNow()) {
            console.log('⏭️  Skipping commit this time - maintaining natural frequency');
            return;
        }

        addLog('🤖 Bot execution started', 'SYSTEM');

        const activity = getRandomActivity();
        const branchName = generateBranchName(activity);
        const commitMessage = getRandomCommitMessage();

        addLog(`🎯 Started working on: ${activity}`, 'ACTIVITY');

        // In GitHub Actions, we're already on main branch
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        addLog(`📍 Current branch: ${currentBranch}`, 'BRANCH');

        // Ensure we're on main (should already be in GitHub Actions)
        if (currentBranch !== 'main') {
            await git.checkout('main');
            addLog('🔄 Switched to main branch', 'BRANCH');
        }

        // Sync with remote before any operations
        if (!(await syncWithRemote())) {
            return;
        }

        // Create new branch from clean main
        await git.checkoutLocalBranch(branchName);
        addLog(`🌿 Created and switched to branch: ${branchName}`, 'BRANCH');

        // Make changes
        const filePath = path.join(__dirname, 'daily_update.txt');
        fs.appendFileSync(filePath, `Activity: ${activity}\n`);

        const progressMessages = [
            '🔍 Analyzing requirements',
            '⚡ Implementing solution',
            '🧪 Running tests',
            '✅ Task completed successfully'
        ];
        const numLogs = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numLogs; i++) {
            if (i < progressMessages.length) {
                addLog(progressMessages[i], 'PROGRESS');
            }
        }

        // Commit and push
        await git.add(filePath);
        await git.commit(commitMessage);
        addLog(`✅ Commit successful: ${commitMessage}`, 'COMMIT');

        await git.push('origin', branchName);
        addLog(`🚀 Branch pushed to remote: ${branchName}`, 'PUSH');

        // Create PR
        const prTitle = `[Auto] ${commitMessage}`;
        const prBody = `Automated PR for ${activity}`;
        const prResult = execSafeSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${branchName}`);

        if (prResult.success) {
            addLog('🔀 Pull request created via GitHub CLI', 'PR');

            const prNumberMatch = prResult.output.match(/(\d+)$/);
            if (prNumberMatch) {
                const prNum = prNumberMatch[1];
                addLog(`📋 PR #${prNum} created successfully`, 'PR');

                // Try auto-merge with better error handling
                await attemptAutoMerge(prNum, branchName);
            }
        } else {
            addLog(`❌ PR creation failed: ${prResult.error}`, 'ERROR');
            await cleanupBranch(branchName);
        }

    } catch (err) {
        addLog(`❌ Error during git/PR process: ${err.message}`, 'ERROR');
        await cleanupBranch(branchName);
    } finally {
        if (!process.env.GITHUB_ACTIONS) {
            releaseLock();
        }
        addLog('🏁 Bot execution finished', 'SYSTEM');
        addLog('─'.repeat(60), 'SEPARATOR');
    }
}

async function attemptAutoMerge(prNum, branchName) {
    try {
        // Wait a bit for PR to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mergeResult = execSafeSync(`gh pr merge ${prNum} --merge --delete-branch`);

        if (mergeResult.success) {
            addLog('🧹 Pull request merged and branch deleted', 'CLEANUP');
        } else {
            addLog(`⚠️ Auto-merge failed: ${mergeResult.error}`, 'WARNING');
            await attemptManualMerge(branchName);
        }
    } catch (error) {
        addLog(`❌ Error during merge attempt: ${error.message}`, 'ERROR');
        await cleanupBranch(branchName);
    }
}

async function attemptManualMerge(branchName) {
    try {
        // Get current branch first
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        addLog(`📍 Currently on branch: ${currentBranch}`, 'BRANCH');
        
        // If we're not on main, switch to main first
        if (currentBranch !== 'main') {
            // Commit any uncommitted changes on current branch first
            try {
                const status = await git.status();
                if (!status.isClean()) {
                    await git.add('.');
                    await git.commit('Temporary commit for manual merge');
                    addLog('📦 Committed pending changes', 'COMMIT');
                }
            } catch (commitErr) {
                addLog(`⚠️ Failed to commit pending changes: ${commitErr.message}`, 'WARNING');
            }
            
            await git.checkout('main');
            addLog('🔄 Switched to main branch', 'BRANCH');
        }
        
        // Sync with remote
        await syncWithRemote();
        
        // Merge the branch
        await git.merge([branchName]);
        addLog('🔄 Manual merge completed', 'CLEANUP');
        
        // Push to main (we're already on main)
        let pushSuccess = false;
        for (let i = 0; i < 3; i++) {
            try {
                await git.push('origin', 'main');
                pushSuccess = true;
                addLog('� Changes pushed successfully', 'PUSH');
                break;
            } catch (pushError) {
                addLog(`⚠️ Push attempt ${i + 1} failed: ${pushError.message}`, 'WARNING');
                if (i < 2) {
                    await syncWithRemote();
                    await git.merge([branchName]);
                }
            }
        }
        
        if (!pushSuccess) {
            addLog('❌ All push attempts failed', 'ERROR');
        }
        
        // Clean up local branch
        await cleanupBranch(branchName);
        
    } catch (manualMergeErr) {
        addLog(`❌ Manual merge failed: ${manualMergeErr.message}`, 'ERROR');
        await cleanupBranch(branchName);
    }
}

async function cleanupBranch(branchName) {
    try {
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        if (currentBranch !== 'main') {
            await safeStashAndCheckout('main');
        }
        
        // Delete local branch if exists
        try {
            await git.deleteLocalBranch(branchName);
            addLog(`🧹 Cleaned up local branch: ${branchName}`, 'CLEANUP');
        } catch (deleteErr) {
            // Branch might not exist, ignore
        }
        
        await safeStashPop();
        
    } catch (cleanupErr) {
        addLog(`⚠️ Cleanup failed: ${cleanupErr.message}`, 'WARNING');
    }
}

if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN or GH_TOKEN environment variable not set');
    process.exit(1);
}

makeCommit();
