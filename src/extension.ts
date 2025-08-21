// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {execa} from 'execa'
import fs from 'node:fs/promises'
import * as vscode from 'vscode'
import path from 'node:path'

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onWillRenameFiles(async(event) => {
            try {
                for (const file of event.files) {
                    const oldPath = file.oldUri.fsPath
                    const newPath = file.newUri.fsPath

                    // Only handle case-only changes (paths are identical when lowercased)
                    if (oldPath.toLowerCase() !== newPath.toLowerCase()) {
                        continue
                    }

                    // Get git project root
                    const {stdout: gitProjectRoot} = await execa('git', ['rev-parse', '--show-toplevel'], {
                        cwd: newPath,
                        shell: vscode.env.shell,
                    })

                    if (!gitProjectRoot) {
                        return
                    }

                    // Get relative paths from git root
                    const relativeOldPath = path.relative(gitProjectRoot, oldPath)
                    const relativeNewPath = path.relative(gitProjectRoot, newPath)

                    // Ensure we have valid relative paths
                    if (!relativeOldPath || !relativeNewPath) {
                        return
                    }

                    const stat = await fs.stat(newPath)
                    let command: string

                    if (stat.isDirectory()) {
                        // For directories, we need to use a temp name approach
                        const tempPath = `${relativeOldPath}_temp`
                        command = `git mv "${relativeOldPath}" "${tempPath}" && git mv "${tempPath}" "${relativeNewPath}"`
                    } else {
                        // For files, we can directly rename
                        command = `git mv "${relativeOldPath}" "${relativeNewPath}"`
                    }

                    const {stderr} = await execa(command, {
                        cwd: gitProjectRoot,
                        shell: true, // Required for command chaining with &&
                    })

                    if (stderr) {
                        vscode.window.showErrorMessage(`Git command failed: ${stderr}`)
                    }
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(error.message || 'An error occurred while renaming files in git.')
            }
        }),
    )
}

export function deactivate() { }
