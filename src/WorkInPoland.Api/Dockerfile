# P6: one container per service, multi-stage. Build context is the REPOSITORY ROOT (the
# solution-level props and the kernel are inputs), which is why .dockerignore is exclusion-based.
#
# Runtime image major == TFM major (net10.0 -> :10.0). Roll-forward does not cross a major and
# getting it wrong is a startup failure, not a warning.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore layer first: project files only, so a code change does not invalidate it.
COPY global.json Directory.Build.props Directory.Packages.props ./
COPY src/WorkInPoland.ServiceDefaults/WorkInPoland.ServiceDefaults.csproj src/WorkInPoland.ServiceDefaults/
COPY src/WorkInPoland.Contracts/WorkInPoland.Contracts.csproj src/WorkInPoland.Contracts/
COPY src/WorkInPoland.Api/WorkInPoland.Api.csproj src/WorkInPoland.Api/
RUN dotnet restore src/WorkInPoland.Api/WorkInPoland.Api.csproj

COPY src/WorkInPoland.ServiceDefaults/ src/WorkInPoland.ServiceDefaults/
COPY src/WorkInPoland.Contracts/ src/WorkInPoland.Contracts/
COPY src/WorkInPoland.Api/ src/WorkInPoland.Api/
RUN dotnet publish src/WorkInPoland.Api/WorkInPoland.Api.csproj \
    -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    DOTNET_EnableDiagnostics=0
EXPOSE 8080
LABEL org.opencontainers.image.source="https://github.com/konradcinkusz/work-in-poland" \
      org.opencontainers.image.description="work-in-poland API: job board REST API and MCP server" \
      org.opencontainers.image.licenses="MIT"
COPY --from=build /app/publish .
# The aspnet image ships a non-root "app" user (UID 1654).
USER $APP_UID
ENTRYPOINT ["dotnet", "WorkInPoland.Api.dll"]
