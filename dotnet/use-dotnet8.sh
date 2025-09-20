#!/bin/bash
# Script to run .NET projects using .NET 8
export PATH="/opt/homebrew/opt/dotnet@8/bin:$PATH" 
export DOTNET_ROOT="/opt/homebrew/opt/dotnet@8/libexec"

echo "Using .NET $(dotnet --version)"
echo "PATH configured for .NET 8"

# Run the command passed as arguments, or start a shell if none provided
if [ $# -eq 0 ]; then
    echo "You can now run dotnet commands with .NET 8"
    echo "Examples:"
    echo "  dotnet --version"
    echo "  dotnet build"
    echo "  dotnet run"
    echo "  dotnet test"
    exec $SHELL
else
    exec "$@"
fi