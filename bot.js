const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const git = simpleGit();
const logBuffer = []; // buffer log ditulis di akhir

const LOCK_FILE = path.join(__dirname, '.bot-lock');
const MAX_LOCK_AGE = 5 * 60 * 1000; // 5 minutes

function acquireLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const lockTime = fs.readFileSync(LOCK_FILE, 'utf8');
            const age = Date.now() - parseInt(lockTime);
            if (age < MAX_LOCK_AGE) return false;
            fs.unlinkSync(LOCK_FILE);
        }
        fs.writeFileSync(LOCK_FILE, Date.now().toString());
        return true;
    } catch {
        return false;
    }
}

function releaseLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    } catch {}
}

function addLog(message, type = 'INFO') {
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
    const logEntry = `[${timestamp} WIB] [${type}] ${message}`;
    logBuffer.push(logEntry);
    console.log(`${type}: ${message}`);
}

function flushLog() {
    if (logBuffer.length === 0) return;
    const filePath = path.join(__dirname, 'daily_update.txt');
    fs.appendFileSync(filePath, logBuffer.join('\n') + '\n');
    logBuffer.length = 0;
}

const commitMessages = [ /* daftar pesan commit */ "💫 Daily workflow commit", "📈 Performance tracking" ];
const activityTypes = [ "feature development", "bug fixing", "deployment preparation" ];

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
        } catch { tracking = {}; }
    }

    if (tracking.date !== today) {
        tracking = {
            date: today,
            count: 0,
            targetCommits: Math.floor(Math.random() * 8) + 8
        };
        const timestamp = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
        fs.appendFileSync(path.join(__dirname, 'daily_update.txt'), `\n🌅 === NEW DAY: ${timestamp} === Target: ${tracking.targetCommits} commits ===\n\n`);
    }

    const shouldCommit = tracking.count < tracking.targetCommits;
    if (shouldCommit) tracking.count += 1;
    fs.writeFileSync(trackingFile, JSON.stringify(tracking, null, 2));

    console.log(`Today's progress: ${tracking.count}/${tracking.targetCommits} commits`);
    return shouldCommit;
}

function execSafeSync(command, options = {}) {
    try {
        const result = execSync(command, { encoding: 'utf8', stdio: 'pipe', ...options });
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
        const status = await git.status();
        if (status.files.length > 0) {
            await git.stash(['--include-untracked']);
            addLog('📦 Stashed changes before switching branch', 'STASH');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        await git.checkout(targetBranch);
        addLog(`🔄 Switched to branch: ${targetBranch}`, 'BRANCH');
        return true;
    } catch (error) {
        addLog(`❌ Failed to switch to ${targetBranch}: ${error.message}`, 'ERROR');
        return false;
    }
}

async function safeStashPop() {
    try {
        if (process.env.GITHUB_ACTIONS) return true;
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
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        addLog(`📍 Current branch: ${currentBranch}`, 'BRANCH');

        if (currentBranch !== 'main') {
            await git.checkout('main');
            addLog('🔄 Switched to main branch', 'BRANCH');
        }

        if (!(await syncWithRemote())) return;

        await git.checkoutLocalBranch(branchName);
        addLog(`🌿 Created and switched to branch: ${branchName}`, 'BRANCH');

        const filePath = path.join(__dirname, 'daily_update.txt');
        fs.appendFileSync(filePath, `Activity: ${activity}\n`);
        ['🔍 Analyzing requirements', '⚡ Implementing solution', '🧪 Running tests'].forEach(msg => {
            if (Math.random() > 0.5) addLog(msg, 'PROGRESS');
        });

        await git.add(filePath);
        await git.commit(commitMessage);
        addLog(`✅ Commit successful: ${commitMessage}`, 'COMMIT');
        await git.push('origin', branchName);
        addLog(`🚀 Branch pushed to remote: ${branchName}`, 'PUSH');

        const prTitle = `[Auto] ${commitMessage}`;
        const prBody = `Automated PR for ${activity}`;
        const prResult = execSafeSync(`gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${branchName}`);

        if (prResult.success) {
            addLog('🔀 Pull request created via GitHub CLI', 'PR');
            const prMatch = prResult.output.match(/#(\d+)/);
            const prNum = prMatch ? prMatch[1] : null;
            if (prNum) {
                addLog(`📋 PR #${prNum} created successfully`, 'PR');
                await attemptAutoMerge(prNum, branchName);
            }
        } else {
            addLog(`❌ PR creation failed: ${prResult.error}`, 'ERROR');
            await cleanupBranch(branchName);
        }

    } catch (err) {
        addLog(`❌ Error during git/PR process: ${err.message}`, 'ERROR');
    } finally {
        if (!process.env.GITHUB_ACTIONS) releaseLock();
        addLog('🏁 Bot execution finished', 'SYSTEM');
        addLog('─'.repeat(60), 'SEPARATOR');
        flushLog();
    }
}

async function attemptAutoMerge(prNum, branchName) {
    try {
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
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        addLog(`📍 Currently on branch: ${currentBranch}`, 'BRANCH');

        const switched = await safeStashAndCheckout('main');
        if (!switched) {
            addLog(`❌ Could not switch to main for manual merge`, 'ERROR');
            return;
        }

        await syncWithRemote();
        await git.merge([branchName]);
        addLog('🔄 Manual merge completed', 'CLEANUP');
        await git.push('origin', 'main');
        addLog('✅ Changes pushed successfully', 'PUSH');
        await cleanupBranch(branchName);

    } catch (err) {
        addLog(`❌ Manual merge failed: ${err.message}`, 'ERROR');
        await cleanupBranch(branchName);
    }
}

async function cleanupBranch(branchName) {
    try {
        const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        if (currentBranch !== 'main') {
            const status = await git.status();
            if (!status.isClean()) {
                await git.stash(['--include-untracked']);
                addLog('📦 Stashed changes before returning to main', 'STASH');
            }
            await git.checkout('main');
            addLog('🔄 Switched back to main branch', 'BRANCH');
        }

        try {
            await git.deleteLocalBranch(branchName, true);
            addLog(`🧹 Cleaned up local branch: ${branchName}`, 'CLEANUP');
        } catch (err) {
            addLog(`⚠️ Could not delete branch ${branchName}: ${err.message}`, 'WARNING');
        }

        await safeStashPop();
    } catch (err) {
        addLog(`⚠️ Cleanup failed: ${err.message}`, 'WARNING');
    }
}

if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN or GH_TOKEN environment variable not set');
    process.exit(1);
}

makeCommit();
